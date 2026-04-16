/**
 * result_report.js
 * Professional Medical Report Generation for SkinCare AI
 */

document.addEventListener('DOMContentLoaded', function () {
    // 1. Set current clinical dates
    const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const analysisDateEl = document.getElementById('analysisDate');
    const reportDateEl = document.getElementById('reportDate');
    const reportYearEl = document.getElementById('reportYear');

    if (analysisDateEl) analysisDateEl.textContent = currentDate;
    if (reportDateEl) reportDateEl.textContent = currentDate;
    if (reportYearEl) reportYearEl.textContent = new Date().getFullYear();

    // 2. Animate diagnostic cards on scroll (Optional if not using main.js reveal)
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Target key clinical blocks for smooth entry
    const cards = document.querySelectorAll('.result-main-card, .advice-group');
    cards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(card);
    });
});

/**
 * Enhanced PDF Generation function using manual jsPDF assembly
 * @param {string} datasetName - 'HAM10000' or 'BCN20000'
 * @param {Event} event - The triggering click event
 */
async function generatePDF(datasetName, event) {
    // If event isn't passed, try to use global event (for direct onclick)
    const triggerEvent = event || window.event;
    if (!triggerEvent) {
        console.error('Event object not found');
        return;
    }

    const btn = triggerEvent.target.closest('button');
    const originalHTML = btn.innerHTML;

    // Loading State
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Generating Medical PDF...';

    try {
        const { jsPDF } = window.jspdf;

        // Metadata for Filename
        const multiLabelEl = document.querySelector('.result-class');
        const diagnosisName = multiLabelEl ? multiLabelEl.textContent.split(': ')[1].replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'skin_report';
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `SkinCareAI_Report_${datasetName}_${diagnosisName}_${timestamp}.pdf`;

        // Define exact sections to capture in order
        const sections = [
            document.querySelector('.diagnostic-header'),
            document.querySelector('.gauges-container'),
            document.querySelector('.comparison-container').parentElement, // Includes the header
            ...document.querySelectorAll('.advice-group'),
            document.querySelector('.report-disclaimer') // Disclaimer paragraph
        ];

        const validSections = sections.filter(section => section !== null);

        if (validSections.length === 0) throw new Error('Clinical content not found.');

        // Create PDF (A4 Format)
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;
        const contentWidth = pageWidth - (2 * margin);

        let currentY = margin;

        // ═══ ADD BRANDED HEADER ═══
        pdf.setFontSize(18);
        pdf.setTextColor(10, 92, 122); // --clr-primary
        pdf.setFont("helvetica", "bold");
        pdf.text('SkinCare AI - Professional Diagnostic Report', margin, currentY);
        currentY += 7;

        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Dataset Origin: ${datasetName} Pipeline | Generated: ${new Date().toLocaleDateString()}`, margin, currentY);
        currentY += 8;

        // Structural Line
        pdf.setDrawColor(25, 181, 160); // --clr-accent
        pdf.setLineWidth(0.4);
        pdf.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 12;

        // ═══ PROCESS SECTIONS ═══
        for (let i = 0; i < validSections.length; i++) {
            const section = validSections[i];

            // Use a temporary attribute for robust identification in the clone
            section.setAttribute('data-pdf-export', 'true');

            // Capture as high-res canvas
            const canvas = await html2canvas(section, {
                scale: 3, // Higher scale for crisp medical text
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                onclone: (clonedDoc) => {
                    // Find the precise cloned element
                    const target = clonedDoc.querySelector('[data-pdf-export="true"]');
                    if (target) {
                        target.style.opacity = '1';
                        target.style.transform = 'none';
                        target.style.visibility = 'visible';
                        target.style.padding = '10px'; // Add breathing room
                    }
                }
            });

            // Clean up original element
            section.removeAttribute('data-pdf-export');

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const imgWidth = contentWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            // ═══ SMART PAGINATION ═══
            if (currentY + imgHeight > pageHeight - margin) {
                // If section is extremely tall (e.g. advice block), split it
                if (imgHeight > pageHeight - (2 * margin)) {
                    const remainingSpace = pageHeight - currentY - margin;

                    if (remainingSpace > 40) { // If there's enough room to start
                        const partialHeight = remainingSpace;
                        const partialCanvas = document.createElement('canvas');
                        const ctx = partialCanvas.getContext('2d');

                        const sourceHeight = (partialHeight * canvas.width) / imgWidth;
                        partialCanvas.width = canvas.width;
                        partialCanvas.height = sourceHeight;

                        ctx.drawImage(canvas, 0, 0, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);
                        const partialImgData = partialCanvas.toDataURL('image/jpeg', 0.95);

                        pdf.addImage(partialImgData, 'JPEG', margin, currentY, imgWidth, partialHeight);

                        // New Page
                        pdf.addPage();
                        currentY = margin + 10;

                        // Second Half
                        const remainingCanvas = document.createElement('canvas');
                        const remainingCtx = remainingCanvas.getContext('2d');
                        remainingCanvas.width = canvas.width;
                        remainingCanvas.height = canvas.height - sourceHeight;

                        remainingCtx.drawImage(canvas, 0, sourceHeight, canvas.width, canvas.height - sourceHeight, 0, 0, canvas.width, canvas.height - sourceHeight);
                        const remainingImgData = remainingCanvas.toDataURL('image/jpeg', 0.95);
                        const remainingHeight = (remainingCanvas.height * imgWidth) / remainingCanvas.width;

                        pdf.addImage(remainingImgData, 'JPEG', margin, currentY, imgWidth, remainingHeight);
                        currentY += remainingHeight + 10;
                    } else {
                        // Just start on new page
                        pdf.addPage();
                        currentY = margin + 10;
                        pdf.addImage(imgData, 'JPEG', margin, currentY, imgWidth, imgHeight);
                        currentY += imgHeight + 10;
                    }
                } else {
                    // Small section, push to next page
                    pdf.addPage();
                    currentY = margin + 10;

                    // Re-add header on new page for flow
                    pdf.setFontSize(8);
                    pdf.setTextColor(150);
                    pdf.text(`${datasetName} Diagnostic Analysis - Cont.`, margin, margin);

                    pdf.addImage(imgData, 'JPEG', margin, currentY, imgWidth, imgHeight);
                    currentY += imgHeight + 10;
                }
            } else {
                // Standard add to current page
                pdf.addImage(imgData, 'JPEG', margin, currentY, imgWidth, imgHeight);
                currentY += imgHeight + 10;
            }
        }

        // ═══ FOOTER & SAVE ═══
        const totalPages = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);
            pdf.setFontSize(8);
            pdf.setTextColor(150);
            pdf.text(`Page ${i} of ${totalPages} | SkinCare AI Verification Result`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        }

        pdf.save(filename);

        // Restore UI
        btn.disabled = false;
        btn.innerHTML = originalHTML;

    } catch (error) {
        console.error('Enhanced PDF Error:', error);
        btn.disabled = false;
        btn.innerHTML = originalHTML;
        alert('Diagnostic Export Error: ' + error.message);
    }
}
