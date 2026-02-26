import React, { useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    TouchableOpacity, StatusBar, SafeAreaView
} from 'react-native';

interface Section {
    id: string;
    icon: string;
    title: string;
    steps: Step[];
}

interface Step {
    heading?: string;
    body: string;
    tip?: string;
    warning?: string;
}

const HELP_CONTENT: Section[] = [
    {
        id: 'getting_started',
        icon: '🚀',
        title: 'Getting Started',
        steps: [
            {
                heading: 'Login',
                body: 'Open the app and sign in with your email and password. The app will load your allocated inspections automatically.',
            },
            {
                heading: 'Inspection List',
                body: 'After login you will see a list of all inspections allocated to you. Each card shows the asset ID, type, and current status.',
                tip: 'Tap SYNC at the top to refresh your list and download any new allocations from the office.',
            },
            {
                heading: 'Starting an Inspection',
                body: 'Tap any inspection from the list to open it, then tap SCAN to scan the asset barcode to verify you are at the correct asset.',
                warning: 'If you scan the wrong barcode the app will alert you and return to the scanner.',
            },
        ],
    },
    {
        id: 'barcode_scanning',
        icon: '📷',
        title: 'Barcode Scanning',
        steps: [
            {
                heading: 'Vehicle (PDF417)',
                body: 'Hold the scanner over the PDF417 barcode on the vehicle registration disc or dashboard. The rectangular guide box should frame the barcode.',
                tip: 'Use the TURN LIGHT ON button if lighting is poor.',
            },
            {
                heading: 'Refrigeration Unit (Code-128)',
                body: 'Scan the standard barcode on the serial number plate of the unit. Adjust the Brightness / Exposure slider if the barcode is hard to read.',
            },
            {
                heading: 'Barcode Not Reading?',
                body: '1. Adjust the Exposure slider up or down.\n2. Toggle the torch on.\n3. Try moving closer or further away.\n4. Tap RETRY SENSOR SCAN if the camera fails to initialise.',
            },
        ],
    },
    {
        id: 'inspection_checklist',
        icon: '✅',
        title: 'Completing the Checklist',
        steps: [
            {
                heading: 'Select Inspection Type',
                body: 'Tap the inspection type tab at the top of the screen (e.g. Road Worthy Inspection or Full Inspection). You can switch types at any time — your entries will reset.',
            },
            {
                heading: 'Mark Each Item',
                body: 'For each sub-item tap PASS (green) or FAIL (red). You can tap the same button again to deselect it.',
            },
            {
                heading: 'Recording a Failure',
                body: 'When you tap FAIL:\n1. A comment box appears — describe the defect.\n2. Tick "Evidence photo" to enable the 📸 Capture button.\n3. Tap 📸 Capture to photograph the defect.\n4. Tap 👁️ View to review the photo.',
                tip: 'Long descriptions help the office understand the severity.',
            },
            {
                heading: 'Odometer (Vehicles Only)',
                body: 'Scroll to Final Details and enter the current odometer reading, or tap 📸 SCAN to use the camera to read the numbers automatically.',
            },
            {
                heading: 'Saving the Inspection',
                body: 'Tap Finish & Save Inspection at the bottom. The result is sent to the office system immediately if you are online, or queued for sync if offline.',
            },
        ],
    },
    {
        id: 'photo_audit',
        icon: '🖼️',
        title: 'Photographic Audit',
        steps: [
            {
                heading: 'What is the Photographic Audit?',
                body: 'This section captures photos of each area of the asset (e.g. Front, Rear, Left, Right, Interior, Engine). Photos are stored against the asset\'s VIN or serial number and build a visual history over time.',
            },
            {
                heading: 'Capturing a Photo',
                body: 'In the Photographic Audit section, tap 📸 Capture next to an area name. The camera screen opens — take the photo. It is saved automatically.',
                tip: 'A blue dot appears on the area card once a photo has been saved.',
            },
            {
                heading: 'Comparing Photos',
                body: 'On subsequent inspections of the same asset, a 🔍 Compare button appears next to any area that already has a photo on file. Tap it to open the Visual Compare screen.',
                warning: 'The Compare button only appears if there is at least one previous photo for that area. Complete a full photographic audit on the first inspection.',
            },
        ],
    },
    {
        id: 'photo_comparison',
        icon: '🔍',
        title: 'Visual Compare Screen',
        steps: [
            {
                heading: 'Overview',
                body: 'The Visual Compare screen overlays the Past photo (white dot) with the Present photo (blue dot). Use the slider and gesture controls to spot differences between the two inspections.',
            },
            {
                heading: 'Opacity Slider',
                body: 'Drag the slider at the bottom left to reveal the Past photo, right to reveal the Present photo. The midpoint blends both images together — ideal for spotting changes.',
            },
            {
                heading: 'Zoom — Pinch two fingers',
                body: 'Pinch two fingers on the image to zoom in or out. Both images scale together so you can examine fine details.',
            },
            {
                heading: 'Pan — Drag with two fingers',
                body: 'After zooming in, drag with two fingers to move around the image.',
            },
            {
                heading: 'Rotate — Twist two fingers',
                body: 'Twist two fingers to rotate both images. Useful when photos were taken from slightly different angles.',
            },
            {
                heading: '↺ Reset View',
                body: 'Tap Reset View to snap both images back to their original position, scale, and rotation.',
            },
            {
                heading: '🎯 Align Mode',
                body: 'Tap the Align button in the toolbar to enter Align Mode. In this mode all gestures (zoom, pan, rotate) only affect the Present (overlay) image. Use this to manually line up the two photos before scanning for differences.',
                tip: 'Once aligned, switch back to Normal mode before doing the Auto Scan for best results.',
            },
            {
                heading: '↺ Reset Align',
                body: 'Tap Reset Align to reset only the Present overlay image back to its default position without affecting the global view.',
            },
            {
                heading: '🔍 Auto Scan',
                body: 'Tap Auto Scan in the header to run an automated difference scan. A blue scan line sweeps across the images and auto-detected differences are marked with orange dashed circles labelled A1, A2, A3.',
                tip: 'Align the images first using Align Mode to get more accurate auto-detection.',
            },
            {
                heading: 'Confirming Auto Markers',
                body: 'Tap an orange auto marker to confirm it as a real difference — it turns red. Long-press any marker to remove it entirely.',
            },
            {
                heading: '📍 Mark Mode',
                body: 'Tap the Mark button to enter Mark Mode. Tap anywhere on the image to place a manual difference marker (numbered #1, #2 etc.). Tap the Mark button again (shows Done) to exit.',
            },
            {
                heading: '🗑 Clear Markers',
                body: 'If markers exist, a Clear button appears showing the count. Tap it to remove all markers at once.',
            },
        ],
    },
    {
        id: 'offline',
        icon: '📶',
        title: 'Working Offline',
        steps: [
            {
                heading: 'Start of Day — Sync',
                body: 'Connect to Wi-Fi or mobile data, open the app, and tap SYNC to download all your allocated inspections for the day.',
            },
            {
                heading: 'Field Work (No Internet)',
                body: 'You can complete full inspections offline. All data is saved locally on the phone. You will see a "Saved Offline" message when saving without internet.',
            },
            {
                heading: 'End of Day — Upload',
                body: 'Connect to Wi-Fi or mobile data and tap SYNC again. All completed inspections will be uploaded to the office system automatically.',
                tip: 'Always sync at the end of the day to ensure the office receives your results.',
            },
        ],
    },
    {
        id: 'troubleshooting',
        icon: '🛠️',
        title: 'Troubleshooting',
        steps: [
            {
                heading: 'Camera Not Starting',
                body: 'Tap RETRY SENSOR SCAN on the camera screen. If it still fails, close the app fully and reopen it.',
            },
            {
                heading: 'Inspection Not Available',
                body: 'The barcode did not match any active rental agreement. Check you are scanning the correct asset, or contact the office to confirm the inspection has been allocated to you.',
            },
            {
                heading: 'Compare Button Not Showing',
                body: 'The 🔍 Compare button only appears if a photo has been captured for that area in a previous inspection. Complete a full photo audit on the first inspection of each asset.',
            },
            {
                heading: 'Sync Failing',
                body: 'Check your internet connection. If the problem persists, restart the app and try again. Unsynchronised inspections are safely stored on your device until sync succeeds.',
            },
        ],
    },
];

const HelpScreen = ({ navigation }: any) => {
    const [expandedSections, setExpandedSections] = useState<string[]>(['getting_started']);

    const toggleSection = (id: string) => {
        setExpandedSections(prev =>
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
        );
    };

    const expandAll = () => setExpandedSections(HELP_CONTENT.map(s => s.id));
    const collapseAll = () => setExpandedSections([]);

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>←</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Help & User Guide</Text>
                    <Text style={styles.headerSub}>Inspection App · Stored on device</Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity onPress={expandAll} style={styles.smallBtn}>
                        <Text style={styles.smallBtnText}>▼ All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={collapseAll} style={styles.smallBtn}>
                        <Text style={styles.smallBtnText}>▲ All</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                {HELP_CONTENT.map((section) => {
                    const isExpanded = expandedSections.includes(section.id);
                    return (
                        <View key={section.id} style={styles.section}>
                            {/* Section Header */}
                            <TouchableOpacity
                                style={styles.sectionHeader}
                                onPress={() => toggleSection(section.id)}
                                activeOpacity={0.75}
                            >
                                <Text style={styles.sectionIcon}>{section.icon}</Text>
                                <Text style={styles.sectionTitle}>{section.title}</Text>
                                <Text style={styles.chevron}>{isExpanded ? '▲' : '▼'}</Text>
                            </TouchableOpacity>

                            {/* Section Steps */}
                            {isExpanded && (
                                <View style={styles.stepsContainer}>
                                    {section.steps.map((step, idx) => (
                                        <View key={idx} style={styles.step}>
                                            <View style={styles.stepNumberCircle}>
                                                <Text style={styles.stepNumber}>{idx + 1}</Text>
                                            </View>
                                            <View style={styles.stepContent}>
                                                {step.heading && (
                                                    <Text style={styles.stepHeading}>{step.heading}</Text>
                                                )}
                                                <Text style={styles.stepBody}>{step.body}</Text>
                                                {step.tip && (
                                                    <View style={styles.tipBox}>
                                                        <Text style={styles.tipText}>💡 {step.tip}</Text>
                                                    </View>
                                                )}
                                                {step.warning && (
                                                    <View style={styles.warningBox}>
                                                        <Text style={styles.warningText}>⚠️ {step.warning}</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    );
                })}

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Inspection App · v1.2.4 · Help stored locally on device</Text>
                    <Text style={styles.footerText}>No internet required to view this guide</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#0f172a' },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: '#1e293b',
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
        gap: 12,
    },
    backBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: '#334155',
        justifyContent: 'center', alignItems: 'center',
    },
    backBtnText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
    headerSub: { color: '#64748b', fontSize: 11, marginTop: 2 },
    headerActions: { flexDirection: 'row', gap: 6 },
    smallBtn: {
        paddingHorizontal: 10, paddingVertical: 6,
        backgroundColor: '#334155', borderRadius: 8,
    },
    smallBtnText: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },

    // Scroll
    scroll: { flex: 1, paddingHorizontal: 12, paddingTop: 12 },

    // Section
    section: {
        marginBottom: 10,
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#1e293b',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1e293b',
        paddingVertical: 14,
        paddingHorizontal: 16,
        gap: 10,
    },
    sectionIcon: { fontSize: 20 },
    sectionTitle: { flex: 1, color: '#e2e8f0', fontSize: 15, fontWeight: '700' },
    chevron: { color: '#64748b', fontSize: 12 },

    // Steps
    stepsContainer: { backgroundColor: '#0f172a', paddingVertical: 8 },
    step: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#1e293b',
        gap: 12,
    },
    stepNumberCircle: {
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: '#3b82f6',
        justifyContent: 'center', alignItems: 'center',
        marginTop: 2, flexShrink: 0,
    },
    stepNumber: { color: '#fff', fontSize: 11, fontWeight: '800' },
    stepContent: { flex: 1 },
    stepHeading: {
        color: '#93c5fd', fontSize: 13, fontWeight: '700',
        marginBottom: 4, letterSpacing: 0.3,
    },
    stepBody: { color: '#cbd5e1', fontSize: 13, lineHeight: 20 },

    // Tip / Warning
    tipBox: {
        marginTop: 8, backgroundColor: '#0c4a1e',
        borderRadius: 8, padding: 10,
        borderLeftWidth: 3, borderLeftColor: '#22c55e',
    },
    tipText: { color: '#86efac', fontSize: 12, lineHeight: 18 },
    warningBox: {
        marginTop: 8, backgroundColor: '#431407',
        borderRadius: 8, padding: 10,
        borderLeftWidth: 3, borderLeftColor: '#f97316',
    },
    warningText: { color: '#fdba74', fontSize: 12, lineHeight: 18 },

    // Footer
    footer: {
        alignItems: 'center',
        paddingVertical: 24,
        paddingHorizontal: 20,
        gap: 4,
    },
    footerText: { color: '#334155', fontSize: 11, textAlign: 'center' },
});

export default HelpScreen;
