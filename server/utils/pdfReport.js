import PDFDocument from 'pdfkit';

/**
 * Builds a professional institutional PDF placement report.
 * Streams generated PDF bytes to the provided writable stream.
 *
 * Handles pagination cleanly without unintended blank pages,
 * repeats table headers on page breaks, and numbers all pages accurately.
 *
 * @param {Object} data - Aggregated analytics data from MongoDB
 * @param {import('stream').Writable} writeStream - Destination stream (e.g., Express res)
 * @returns {Promise<void>}
 */
export function generatePlacementPdf(data, writeStream) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 35, bottom: 45, left: 40, right: 40 },
        bufferPages: true,
        autoFirstPage: true,
      });

      doc.on('error', (err) => reject(err));
      writeStream.on('error', (err) => reject(err));
      writeStream.on('finish', () => resolve());

      doc.pipe(writeStream);

      const pageWidth = doc.page.width - 80; // 595.28 - 80 = 515.28 pt
      const startX = 40;
      const contentBottom = doc.page.height - 45; // 841.89 - 45 = 796.89 pt
      const topMarginPage2 = 48; // Top margin on pages 2+ leaving room for running header

      const primaryColor = '#0f172a'; // slate-900
      const accentColor = '#2563eb'; // blue-600
      const lightBg = '#f8fafc'; // slate-50
      const textDark = '#1e293b'; // slate-800
      const textMuted = '#64748b'; // slate-500
      const greenColor = '#16a34a'; // emerald-600

      // Helper: check if we need to cleanly start a new page
      const checkNewPage = (neededHeight) => {
        if (doc.y + neededHeight > contentBottom) {
          doc.addPage();
          doc.y = topMarginPage2;
          return true;
        }
        return false;
      };

      // ---------------- Header Section (Page 1 only) ----------------
      doc.rect(startX, 35, pageWidth, 62).fill(primaryColor);

      doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold');
      doc.text('COLLEGE PLACEMENT MANAGEMENT SYSTEM', startX + 14, 45, {
        width: pageWidth - 28,
        lineBreak: false,
      });

      doc.fillColor('#94a3b8').fontSize(8.5).font('Helvetica');
      doc.text('Official Campus Recruitment & Placement Analytics Report', startX + 14, 63, {
        lineBreak: false,
      });

      const generatedDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      doc.fillColor('#cbd5e1').fontSize(7.5);
      doc.text(`Generated on: ${generatedDate}`, startX + 14, 80, { lineBreak: false });
      doc.text('Classification: Institutional Confidential', startX + 14, 80, {
        align: 'right',
        width: pageWidth - 28,
        lineBreak: false,
      });

      doc.y = 107;

      // ---------------- Section 1: Executive KPI Cards ----------------
      doc.fillColor(primaryColor).fontSize(10.5).font('Helvetica-Bold');
      doc.text('1. Executive Placement Summary', startX, doc.y);
      doc.moveDown(0.3);

      const totals = data.totals || {};
      const kpis = [
        { label: 'Registered Students', val: totals.totalStudents || 0 },
        { label: 'Students Placed', val: totals.placedStudents || 0 },
        { label: 'Not Placed', val: totals.notPlacedStudents || 0 },
        { label: 'Placement Rate', val: `${totals.placementPercentage || 0}%`, color: greenColor },
        { label: 'Total Drives / Open', val: `${totals.totalCompanies || 0} / ${totals.totalDrivesOpen || 0}` },
        { label: 'Total Applications', val: totals.totalApplications || 0 },
      ];

      const kpiY = doc.y;
      const kpiCardWidth = (pageWidth - 16) / 3;
      const kpiCardHeight = 36;

      kpis.forEach((kpi, i) => {
        const row = Math.floor(i / 3);
        const col = i % 3;
        const x = startX + col * (kpiCardWidth + 8);
        const y = kpiY + row * (kpiCardHeight + 6);

        doc.roundedRect(x, y, kpiCardWidth, kpiCardHeight, 4).fillAndStroke('#f8fafc', '#cbd5e1');

        doc.fillColor(textMuted).fontSize(7).font('Helvetica');
        doc.text(kpi.label.toUpperCase(), x + 8, y + 6, {
          width: kpiCardWidth - 16,
          lineBreak: false,
        });

        doc.fillColor(kpi.color || primaryColor).fontSize(11.5).font('Helvetica-Bold');
        doc.text(String(kpi.val), x + 8, y + 17, {
          width: kpiCardWidth - 16,
          lineBreak: false,
        });
      });

      doc.y = kpiY + 2 * (kpiCardHeight + 6) + 10;

      // ---------------- Section 2: Compensation Overview (if available) ----------------
      if (data.packageStats && data.packageStats.highest > 0) {
        checkNewPage(55);

        doc.fillColor(primaryColor).fontSize(10.5).font('Helvetica-Bold');
        doc.text('2. Compensation & Package Overview', startX, doc.y);
        doc.moveDown(0.3);

        const pkgY = doc.y;
        const pkgItems = [
          { label: 'HIGHEST PACKAGE', val: `${data.packageStats.highest} LPA` },
        ];

        if (
          data.packageStats.averagePerStudent !== undefined &&
          data.packageStats.averagePerStudent !== null
        ) {
          pkgItems.push({
            label: 'AVG / PLACED CANDIDATE',
            val: `${data.packageStats.averagePerStudent} LPA`,
          });
        }

        const avgOfferVal =
          data.packageStats.averagePerOffer !== undefined &&
          data.packageStats.averagePerOffer !== null
            ? data.packageStats.averagePerOffer
            : data.packageStats.average;

        pkgItems.push({
          label:
            pkgItems.length > 1 ? 'AVG / CONFIRMED OFFER' : 'AVERAGE PACKAGE',
          val: `${avgOfferVal} LPA`,
        });

        pkgItems.push({
          label: 'MINIMUM PACKAGE',
          val: `${data.packageStats.lowest} LPA`,
        });

        const numCards = pkgItems.length;
        const totalGap = (numCards - 1) * 8;
        const pkgCardWidth = (pageWidth - totalGap) / numCards;

        pkgItems.forEach((pkg, idx) => {
          const x = startX + idx * (pkgCardWidth + 8);
          doc.roundedRect(x, pkgY, pkgCardWidth, 34, 4).fillAndStroke('#f0fdf4', '#86efac');
          doc.fillColor('#166534').fontSize(numCards > 3 ? 6.5 : 7).font('Helvetica-Bold');
          doc.text(pkg.label, x + 6, pkgY + 5, {
            width: pkgCardWidth - 12,
            lineBreak: false,
          });
          doc.fillColor('#14532d').fontSize(numCards > 3 ? 10.5 : 11).font('Helvetica-Bold');
          doc.text(pkg.val, x + 6, pkgY + 17, {
            width: pkgCardWidth - 12,
            lineBreak: false,
          });
        });

        doc.y = pkgY + 34 + 10;
      }

      // ---------------- Table Renderer with Automatic Pagination ----------------
      const drawTable = (title, headers, rows, colWidths, options = {}) => {
        const rowHeight = 17;
        const headerHeight = 18;
        const minSectionHeight = 22 + headerHeight + rowHeight * Math.min(2, rows.length);

        // Prevent stranded headings: move section to next page if minimum content won't fit
        checkNewPage(minSectionHeight);

        // Section Title
        doc.fillColor(primaryColor).fontSize(10.5).font('Helvetica-Bold');
        doc.text(title, startX, doc.y);
        doc.moveDown(0.3);

        const renderTableHeader = (yPos) => {
          doc.rect(startX, yPos, pageWidth, headerHeight).fill(accentColor);
          doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
          let colX = startX;
          headers.forEach((h, i) => {
            doc.text(h, colX + 6, yPos + 5, {
              width: colWidths[i] - 12,
              align: options.alignRight?.includes(i) ? 'right' : 'left',
              lineBreak: false,
            });
            colX += colWidths[i];
          });
        };

        let currentY = doc.y;
        renderTableHeader(currentY);
        currentY += headerHeight;

        rows.forEach((row, rIndex) => {
          // Check if row overflows current page
          if (currentY + rowHeight > contentBottom) {
            doc.addPage();
            currentY = topMarginPage2;
            // Repeat table headers on the new page
            renderTableHeader(currentY);
            currentY += headerHeight;
          }

          if (rIndex % 2 === 0) {
            doc.rect(startX, currentY, pageWidth, rowHeight).fill(lightBg);
          }

          doc.fillColor(textDark).fontSize(7.5).font('Helvetica');
          let colX = startX;
          row.forEach((val, cIndex) => {
            const isHighlight = options.highlightCols?.includes(cIndex);
            if (isHighlight) {
              doc.font('Helvetica-Bold').fillColor(primaryColor);
            } else {
              doc.font('Helvetica').fillColor(textDark);
            }

            doc.text(String(val ?? '-'), colX + 6, currentY + 4.5, {
              width: colWidths[cIndex] - 12,
              align: options.alignRight?.includes(cIndex) ? 'right' : 'left',
              lineBreak: false,
            });
            colX += colWidths[cIndex];
          });

          // Subtle bottom border for row
          doc.rect(startX, currentY + rowHeight - 0.5, pageWidth, 0.5).fill('#e2e8f0');
          currentY += rowHeight;
        });

        doc.y = currentY + 10;
      };

      // ---------------- Section 3: Branch-Wise Placement Statistics ----------------
      const branchStats = data.branchStats || [];
      if (branchStats.length > 0) {
        const branchHeaders = ['Academic Branch', 'Registered', 'Placed', 'Not Placed', 'Placement Rate'];
        const branchColWidths = [185, 75, 75, 75, 105.28];
        const branchRows = branchStats.map((item) => {
          const notPlaced = Math.max(0, (item.total || 0) - (item.placed || 0));
          return [item.branch, item.total, item.placed, notPlaced, `${item.percentage}%`];
        });

        drawTable('3. Branch-Wise Placement Performance', branchHeaders, branchRows, branchColWidths, {
          alignRight: [1, 2, 3, 4],
          highlightCols: [0, 4],
        });
      }

      // ---------------- Section 4: Top Recruiting Companies ----------------
      const companyPlacements = data.companyPlacements || [];
      if (companyPlacements.length > 0) {
        const compHeaders = ['Recruiting Company', 'Placed Students Count'];
        const compColWidths = [365.28, 150];
        const compRows = companyPlacements.map((c) => [c.companyName, c.count]);

        drawTable('4. Leading Recruiters by Selections', compHeaders, compRows, compColWidths, {
          alignRight: [1],
          highlightCols: [0, 1],
        });
      }

      // ---------------- Section 5: Application Status Breakdown ----------------
      const appStats = data.applicationStatus || [];
      if (appStats.length > 0) {
        const appHeaders = ['Application Pipeline Stage', 'Total Candidates'];
        const appColWidths = [365.28, 150];
        const appRows = appStats.map((s) => [s.status, s.count]);

        drawTable('5. Recruitment Application Pipeline', appHeaders, appRows, appColWidths, {
          alignRight: [1],
          highlightCols: [0, 1],
        });
      }

      // ---------------- Section 6: Official Verification & Endorsement ----------------
      checkNewPage(65);
      const endorsementY = doc.y + 4;
      doc.rect(startX, endorsementY, pageWidth, 52).fillAndStroke('#f8fafc', '#e2e8f0');

      doc.fillColor(textDark).fontSize(7.5).font('Helvetica-Bold');
      doc.text('INSTITUTIONAL PLACEMENT CELL CERTIFICATION', startX + 12, endorsementY + 8, {
        lineBreak: false,
      });

      doc.fillColor(textMuted).fontSize(7).font('Helvetica');
      doc.text(
        'Placement percentage reflects unique placed candidates over total registered students in accordance with NIRF & NAAC criteria.',
        startX + 12,
        endorsementY + 20,
        { width: pageWidth - 24, lineBreak: false }
      );

      doc.text(
        'Verified by: Training & Placement Officer (TPO) | Head of Placement Operations',
        startX + 12,
        endorsementY + 34,
        { lineBreak: false }
      );
      doc.text(
        `Authorized Stamp & Date: ${new Date().toISOString().slice(0, 10)}`,
        startX + 12,
        endorsementY + 34,
        { align: 'right', width: pageWidth - 24, lineBreak: false }
      );

      // ---------------- Running Header & Footers for All Pages ----------------
      const range = doc.bufferedPageRange();
      const totalPages = range.count;

      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);

        // Disable margins on page so footer operations NEVER trigger auto-page-breaks
        doc.page.margins.bottom = 0;
        doc.page.margins.top = 0;

        // Running top header for pages 2+
        if (i > 0) {
          doc.rect(startX, 24, pageWidth, 0.75).fill('#cbd5e1');
          doc.fillColor(textMuted).fontSize(7.5).font('Helvetica');
          doc.text('CAMPUS PLACEMENT & RECRUITMENT REPORT', startX, 14, {
            lineBreak: false,
          });
          doc.text('Official Institutional Record', startX, 14, {
            align: 'right',
            width: pageWidth,
            lineBreak: false,
          });
        }

        // Running footer on EVERY page
        const footerY = doc.page.height - 25;
        doc.rect(startX, footerY - 5, pageWidth, 0.5).fill('#cbd5e1');

        doc.fillColor(textMuted).fontSize(7.5).font('Helvetica');
        doc.text('Placement Portal — Confidential Institutional Report', startX, footerY, {
          lineBreak: false,
        });
        doc.text(`Page ${i + 1} of ${totalPages}`, startX, footerY, {
          align: 'right',
          width: pageWidth,
          lineBreak: false,
        });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
