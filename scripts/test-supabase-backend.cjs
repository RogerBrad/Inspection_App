// Tests the Inspection App's Supabase calls from a PC, signed in as a real technician.
// Mirrors src/services/*.ts step by step. Leaves real data unchanged:
//   - the agreement update writes the workflow back unchanged (proves permission only)
//   - the test inspection and photo record are deleted again afterwards
//
// Usage (from the Inspection_App folder):   node scripts/test-supabase-backend.cjs you@company.com

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');

// Read URL and key from the app's own client file, so the test hits exactly what the app uses
const clientSrc = fs.readFileSync(path.join(__dirname, '../src/services/supabaseClient.ts'), 'utf8');
const SUPABASE_URL = clientSrc.match(/SUPABASE_URL = '([^']+)'/)[1];
const SUPABASE_ANON_KEY = clientSrc.match(/SUPABASE_ANON_KEY = '([^']+)'/)[1];
const PHOTO_BUCKET = clientSrc.match(/PHOTO_BUCKET = '([^']+)'/)[1];

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

let failures = 0;
const pass = (msg) => console.log(`  PASS  ${msg}`);
const fail = (msg, err) => { failures++; console.log(`  FAIL  ${msg}${err ? ` -> ${err.message || err}` : ''}`); };

function askHidden(question) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); };
        rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer); });
    });
}

(async () => {
    const email = process.argv[2];
    if (!email) {
        console.log('Usage: node scripts/test-supabase-backend.cjs you@company.com');
        process.exit(1);
    }
    const password = await askHidden(`Password for ${email}: `);

    console.log('\n1. Login (LoginScreen)');
    const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) { fail('sign in', authError); return finish(); }
    pass(`signed in, user id ${auth.user.id}`);

    const { data: profile, error: profileError } = await supabase
        .from('user_profiles').select('id, first_name, surname, email').eq('id', auth.user.id).maybeSingle();
    if (profileError) fail('read own profile', profileError);
    else if (!profile) fail('no user_profiles row for this login - allocations by user ID will not match');
    else pass(`profile found: ${profile.first_name || ''} ${profile.surname || ''}`.trim());

    console.log('\n2. Sync - download allocated inspections (InspectionList "Sync")');
    const { data: allocatedRows, error: syncError } = await supabase
        .from('rental_agreements').select('id, status, inspection_date, agreement_data')
        .eq('agreement_data->inspectionWorkflow->>status', 'Allocated');
    let mine = [];
    if (syncError) fail('query allocated agreements', syncError);
    else {
        mine = (allocatedRows || []).filter(r => {
            const wf = r.agreement_data?.inspectionWorkflow || {};
            return (wf.technicianEmail || '').toLowerCase().trim() === email.toLowerCase().trim()
                || (wf.technicianId || '') === auth.user.id;
        });
        pass(`${allocatedRows.length} allocated in your company, ${mine.length} allocated to you:`);
        mine.forEach(r => console.log(`          - ${r.agreement_data?.assetDetails?.assetName || 'Unknown asset'} ` +
            `(serial ${r.agreement_data?.assetDetails?.serialNumber || 'n/a'}) for ${r.agreement_data?.parties?.lesseeName || 'n/a'}`));
    }

    const target = mine[0];
    const serial = target?.agreement_data?.assetDetails?.serialNumber;

    console.log('\n3. Scan lookup by serial number (ScannerScreen)');
    if (!serial) fail('skipped - no allocated inspection with a serial number');
    else {
        const { data, error } = await supabase.from('rental_agreements').select('id')
            .eq('agreement_data->assetDetails->>serialNumber', serial).limit(1);
        if (error) fail('lookup by serial', error);
        else if (!data.length) fail(`serial ${serial} not found`);
        else pass(`serial ${serial} -> agreement ${data[0].id}`);
    }

    console.log('\n4. Load checklist (DetailsScreen)');
    for (const category of ['refrigeration', 'motor_vehicle']) {
        const { data, error } = await supabase.from('inspection_configs')
            .select('category, inspection_types, areas').eq('category', category).limit(1);
        if (error) fail(`config ${category}`, error);
        else if (!data.length) fail(`config ${category} missing - app falls back to built-in template`);
        else pass(`${category}: ${data[0].inspection_types.map(t => t.label).join(', ')}`);
    }

    console.log('\n5. Save inspection record, then delete it (DetailsScreen "Save & Submit")');
    const { data: inserted, error: insertError } = await supabase.from('inspections').insert({
        asset_id: 'TEST-PC-CHECK', asset_category: 'refrigeration',
        inspection_type_id: 'test', inspection_type_label: 'Backend test (safe to delete)',
        timestamp: new Date().toISOString(), results: [], odometer: null,
        summary: { passCount: 0, failCount: 0 },
    }).select('id').single();
    if (insertError) fail('insert inspection', insertError);
    else {
        pass(`inserted test inspection ${inserted.id}`);
        const { data: history, error: historyError } = await supabase.from('inspections').select('id')
            .eq('asset_id', 'TEST-PC-CHECK').order('timestamp', { ascending: false });
        if (historyError) fail('read history (HistoryScreen)', historyError);
        else pass(`history query returns ${history.length} record(s)`);
        const { error: delError } = await supabase.from('inspections').delete().eq('id', inserted.id);
        if (delError) fail('delete test inspection', delError); else pass('test inspection deleted');
    }

    console.log('\n6. Update agreement workflow - written back unchanged (rentalAgreementService.updateInspectionResult)');
    if (!target) fail('skipped - nothing allocated to you');
    else {
        const { data: updated, error: updError } = await supabase.from('rental_agreements')
            .update({ agreement_data: target.agreement_data }).eq('id', target.id).select('id');
        if (updError) fail('update agreement', updError);
        else if (!updated.length) fail('update blocked by Row Level Security (0 rows changed)');
        else pass('permission to update the agreement confirmed (data unchanged)');
    }

    console.log('\n7. Photo upload (InspectionCameraScreen)');
    // Smallest valid JPEG (1x1 pixel)
    const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
    const photoPath = `test/backend-check/${Date.now()}_Front.jpg`;
    const { data: up, error: upError } = await supabase.storage.from(PHOTO_BUCKET)
        .upload(photoPath, jpeg.buffer.slice(jpeg.byteOffset, jpeg.byteOffset + jpeg.byteLength), { contentType: 'image/jpeg' });
    if (upError) fail('upload to storage', upError);
    else {
        const publicUrl = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(up.path).data.publicUrl;
        const res = await fetch(publicUrl);
        if (res.ok) pass(`uploaded and publicly viewable: ${publicUrl}`); else fail(`uploaded but public URL returned ${res.status}`);

        const { data: photoRow, error: photoError } = await supabase.from('vehicle_photos').insert({
            vin: 'TEST-PC-CHECK', registration_number: '', photo_url: publicUrl, angle: 'Front',
            timestamp: new Date().toISOString(), metadata: { test: true, storagePath: up.path },
        }).select('id').single();
        if (photoError) fail('insert vehicle_photos row', photoError);
        else {
            pass(`photo record saved ${photoRow.id}`);
            const { error: delPhotoError } = await supabase.from('vehicle_photos').delete().eq('id', photoRow.id);
            if (delPhotoError) fail('delete test photo record', delPhotoError); else pass('test photo record deleted');
        }
        const { data: removed } = await supabase.storage.from(PHOTO_BUCKET).remove([up.path]);
        if (!removed || !removed.length) console.log(`  NOTE  test image left at ${PHOTO_BUCKET}/${up.path} (no storage delete policy) - harmless`);
    }

    await supabase.auth.signOut();
    finish();
})().catch((e) => { fail('unexpected error', e); finish(); });

function finish() {
    console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
    process.exit(failures === 0 ? 0 : 1);
}
