export const UNITS = [
  { id: 1, short: 'Teaching Aptitude', hi: 'शिक्षण अभिक्षमता', topics: 'Teaching concepts, learner characteristics, teaching methods, support systems and evaluation.' },
  { id: 2, short: 'Research Aptitude', hi: 'शोध अभिक्षमता', topics: 'Research meaning and types, methods, steps, thesis writing, ICT in research and research ethics.' },
  { id: 3, short: 'Comprehension', hi: 'बोध / गद्यांश', topics: 'Reading comprehension, inference, main idea, tone, vocabulary and passage-based reasoning.' },
  { id: 4, short: 'Communication', hi: 'संचार', topics: 'Communication models, types, effective communication, barriers, classroom communication and mass media.' },
  { id: 5, short: 'Mathematical Reasoning & Aptitude', hi: 'गणितीय तर्क एवं अभिक्षमता', topics: 'Number and letter series, coding, relationships, percentages, ratio, averages, profit-loss, interest, time and distance.' },
  { id: 6, short: 'Logical Reasoning', hi: 'तार्किक तर्क', topics: 'Arguments, deductive and inductive reasoning, analogies, syllogisms, Venn diagrams and Indian logic.' },
  { id: 7, short: 'Data Interpretation', hi: 'आँकड़ा निर्वचन', topics: 'Data sources and classification, tables, charts, graphs, averages, percentages and data-based conclusions.' },
  { id: 8, short: 'ICT', hi: 'सूचना एवं संचार प्रौद्योगिकी', topics: 'Computer fundamentals, internet, intranet, email, networking, digital initiatives and ICT in governance.' },
  { id: 9, short: 'People, Development & Environment', hi: 'जन, विकास एवं पर्यावरण', topics: 'Sustainable development, ecology, pollution, climate change, resources, hazards and environmental agreements.' },
  { id: 10, short: 'Higher Education System', hi: 'उच्च शिक्षा प्रणाली', topics: 'Ancient and modern Indian higher education, regulatory bodies, policies, governance, institutions and value education.' }
];

export const gradeFor = (percent) => {
  if (percent >= 90) return 'A+';
  if (percent >= 80) return 'A';
  if (percent >= 70) return 'B';
  if (percent >= 60) return 'C';
  if (percent >= 50) return 'D';
  return 'Needs Improvement';
};
