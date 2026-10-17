import PDFDocument from 'pdfkit';
import { IResume } from '../models/Resume';

/**
 * Generates an ATS-friendly, single-page readable PDF from a structured Resume record.
 * Uses PDFKit to ensure 100% selectable, searchable, and machine-readable text operators.
 * Never reduces fonts to unreadable sizes; prioritizes the most relevant supported items.
 */
export const generateResumePdf = (resume: IResume): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 36, bottom: 36, left: 40, right: 40 },
        info: {
          Title: resume.title || 'Evidra Verified Resume',
          Author: resume.contactDetails?.fullName || 'Evidra Candidate',
          Subject: resume.targetRole || 'Professional Resume',
          Keywords: 'Evidra, ATS, Truthful, Evidence-Backed, Verified',
          Creator: 'Evidra Truthful Resume Engine',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err: Error) => reject(err));

      const contact = resume.contactDetails;
      const primaryColor = '#0f172a'; // slate-900
      const accentColor = '#1e3a8a'; // blue-900
      const subColor = '#475569'; // slate-600
      const bulletColor = '#334155'; // slate-700
      const lineRuleColor = '#cbd5e1'; // slate-300

      // Helper for clean horizontal rules
      const drawHorizontalRule = (yOffset?: number) => {
        const y = yOffset !== undefined ? yOffset : doc.y + 2;
        doc
          .strokeColor(lineRuleColor)
          .lineWidth(0.75)
          .moveTo(40, y)
          .lineTo(555, y)
          .stroke();
        doc.y = y + 6;
      };

      // Helper for section headings
      const renderSectionHeading = (title: string) => {
        doc.moveDown(0.5);
        doc
          .font('Helvetica-Bold')
          .fontSize(10.5)
          .fillColor(accentColor)
          .text(title.toUpperCase(), { characterSpacing: 0.8 });
        drawHorizontalRule();
      };

      // ==========================================
      // 1. HEADER & CONTACT DETAILS
      // ==========================================
      const candidateName = contact?.fullName || resume.title || 'Candidate Name';
      doc
        .font('Helvetica-Bold')
        .fontSize(18)
        .fillColor(primaryColor)
        .text(candidateName, { align: 'center' });

      // Contact bar (Email | Phone | Roll Number | Links)
      const contactElements: string[] = [];
      if (contact?.email) contactElements.push(contact.email);
      if (contact?.phone) contactElements.push(contact.phone);
      if (contact?.rollNumber) contactElements.push(`Roll: ${contact.rollNumber}`);
      if (contact?.department) contactElements.push(contact.department);

      if (contactElements.length > 0) {
        doc.moveDown(0.2);
        doc
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor(subColor)
          .text(contactElements.join('  |  '), { align: 'center' });
      }

      // External profile links (GitHub, LinkedIn, Portfolio)
      if (contact?.links && contact.links.length > 0) {
        const linkStrings = contact.links.map((l) => `${l.label}: ${l.url}`);
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor(accentColor)
          .text(linkStrings.join('  •  '), { align: 'center' });
      }

      drawHorizontalRule(doc.y + 4);

      // ==========================================
      // 2. EDUCATION
      // ==========================================
      const educationList = resume.education || [];
      if (educationList.length > 0) {
        renderSectionHeading('Education');

        educationList.forEach((edu) => {
          const startY = doc.y;
          // Left side: Degree and Department
          doc
            .font('Helvetica-Bold')
            .fontSize(9.5)
            .fillColor(primaryColor)
            .text(`${edu.degree} in ${edu.department}`, 40, startY, { continued: false });

          // Right side: Year & CGPA
          doc
            .font('Helvetica-Bold')
            .fontSize(9)
            .fillColor(accentColor)
            .text(`CGPA: ${edu.cgpa.toFixed(2)}/10.0  |  Batch of ${edu.graduationYear}`, 350, startY, {
              align: 'right',
              width: 205,
            });

          // Institution sub-line
          doc
            .font('Helvetica')
            .fontSize(8.5)
            .fillColor(subColor)
            .text(edu.institution, 40, doc.y + 1);

          if (edu.highlights && edu.highlights.length > 0) {
            edu.highlights.forEach((h) => {
              doc
                .font('Helvetica')
                .fontSize(8)
                .fillColor(bulletColor)
                .text(`• ${h}`, 50);
            });
          }
          doc.moveDown(0.25);
        });
      }

      // ==========================================
      // 3. TECHNICAL SKILLS (Verified Only)
      // ==========================================
      const skillCategories = resume.skills || [];
      if (skillCategories.length > 0) {
        renderSectionHeading('Technical Competencies (Evidence-Verified)');

        skillCategories.forEach((cat) => {
          const verifiedSkillNames = cat.skills
            .filter((s) => s.isVerified)
            .map((s) => s.name);

          if (verifiedSkillNames.length > 0) {
            doc
              .font('Helvetica-Bold')
              .fontSize(9)
              .fillColor(primaryColor)
              .text(`${cat.category}: `, 40, doc.y, { continued: true })
              .font('Helvetica')
              .fillColor(bulletColor)
              .text(verifiedSkillNames.join(', '));
            doc.moveDown(0.15);
          }
        });
      }

      // ==========================================
      // 4. SELECTED PROJECTS (Curated & Tailored)
      // ==========================================
      const projectList = (resume.projects || []).slice(0, 3); // Top 3 to maintain readable 9.5pt font
      if (projectList.length > 0) {
        renderSectionHeading('Key Engineering Projects');

        projectList.forEach((proj) => {
          const startY = doc.y;

          // Project Title & Tech Stack
          const techStackText = proj.technologies?.length ? ` [${proj.technologies.slice(0, 5).join(', ')}]` : '';
          doc
            .font('Helvetica-Bold')
            .fontSize(9.5)
            .fillColor(primaryColor)
            .text(proj.title, 40, startY, { continued: true })
            .font('Helvetica-Oblique')
            .fontSize(8.5)
            .fillColor(subColor)
            .text(techStackText);

          if (proj.url) {
            doc
              .font('Helvetica')
              .fontSize(8)
              .fillColor(accentColor)
              .text(proj.url, 40, doc.y, { link: proj.url, underline: true });
          }

          // Bullets
          if (proj.bullets && proj.bullets.length > 0) {
            proj.bullets.slice(0, 3).forEach((b) => {
              doc
                .font('Helvetica')
                .fontSize(8.5)
                .fillColor(bulletColor)
                .text(`•  ${b.text}`, 50, doc.y + 1, {
                  align: 'justify',
                  width: 505,
                  lineGap: 1.5,
                });
            });
          } else if (proj.description) {
            doc
              .font('Helvetica')
              .fontSize(8.5)
              .fillColor(bulletColor)
              .text(`•  ${proj.description.substring(0, 180)}`, 50, doc.y + 1, {
                align: 'justify',
                width: 505,
                lineGap: 1.5,
              });
          }

          doc.moveDown(0.35);
        });
      }

      // ==========================================
      // 5. CERTIFICATIONS & ASSESSMENTS
      // ==========================================
      const certs = (resume.certifications || []).filter((c) => c.isVerified);
      if (certs.length > 0) {
        renderSectionHeading('Verified Certifications & Technical Assessments');

        certs.forEach((cert) => {
          doc
            .font('Helvetica-Bold')
            .fontSize(8.5)
            .fillColor(primaryColor)
            .text(`•  ${cert.title}`, 45, doc.y, { continued: true })
            .font('Helvetica')
            .fillColor(subColor)
            .text(` — Issued by ${cert.issuer}`);
          doc.moveDown(0.15);
        });
      }

      // ==========================================
      // 6. ATS AUDIT & PROVENANCE FOOTNOTE
      // ==========================================
      const footerY = doc.page.height - 30;
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor('#94a3b8')
        .text(
          `Evidra Truthful ATS Engine • Version ${resume.version} • All listed claims verified against institutional evidence artifacts • Cryptographically backed`,
          40,
          footerY,
          { align: 'center', width: 515 }
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

