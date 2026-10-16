/**
 * Utility for formatting application records into RFC 4180 compliant CSV.
 */

const escapeCsvField = (field: unknown): string => {
  if (field === null || field === undefined) {
    return '';
  }
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const exportApplicationsToCsv = (applications: any[]): string => {
  const headers = [
    'Application ID',
    'Roll Number',
    'Candidate Name',
    'Candidate Email',
    'Department',
    'Degree',
    'CGPA',
    'Job Title',
    'Company',
    'Workplace Type',
    'Job Type',
    'Current Status',
    'Applied Date',
    'Last Updated',
    'Resume Title',
    'Resume Version',
    'Interview Round',
    'Interview Type',
    'Interview Scheduled Date',
    'Offered CTC',
    'Currency',
    'Joining Date',
    'Offer Deadline',
  ];

  const rows = applications.map((app) => {
    const student = app.student || {};
    const user = student.user || {};
    const job = app.job || {};
    const company = job.company || {};
    const resume = app.resume || {};
    const resumeSnapshot = app.resumeSnapshot || {};
    const interview = app.interviewDetails || {};
    const offer = app.offerDetails || {};

    const appliedDateStr = app.appliedAt
      ? new Date(app.appliedAt).toISOString().split('T')[0]
      : '';
    const updatedDateStr = app.updatedAt
      ? new Date(app.updatedAt).toISOString().split('T')[0]
      : '';
    const interviewDateStr = interview.scheduledAt
      ? new Date(interview.scheduledAt).toISOString().split('T')[0]
      : '';
    const joiningDateStr = offer.joiningDate
      ? new Date(offer.joiningDate).toISOString().split('T')[0]
      : '';
    const offerDeadlineStr = offer.deadline
      ? new Date(offer.deadline).toISOString().split('T')[0]
      : '';

    return [
      escapeCsvField(app._id?.toString() || ''),
      escapeCsvField(student.rollNumber || ''),
      escapeCsvField(user.name || user.email?.split('@')[0] || ''),
      escapeCsvField(user.email || ''),
      escapeCsvField(student.department || ''),
      escapeCsvField(student.degree || ''),
      escapeCsvField(student.cgpa !== undefined ? student.cgpa : ''),
      escapeCsvField(job.title || ''),
      escapeCsvField(company.name || ''),
      escapeCsvField(job.workplaceType || ''),
      escapeCsvField(job.jobType || ''),
      escapeCsvField(app.currentStatus || ''),
      escapeCsvField(appliedDateStr),
      escapeCsvField(updatedDateStr),
      escapeCsvField(resumeSnapshot.title || resume.title || ''),
      escapeCsvField(app.resumeVersion || resume.version || 1),
      escapeCsvField(interview.round || ''),
      escapeCsvField(interview.interviewType || ''),
      escapeCsvField(interviewDateStr),
      escapeCsvField(offer.offeredCtc !== undefined ? offer.offeredCtc : ''),
      escapeCsvField(offer.currency || 'INR'),
      escapeCsvField(joiningDateStr),
      escapeCsvField(offerDeadlineStr),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
};
