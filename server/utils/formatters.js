const techExceptions = {
  "Macos": "macOS",
  "Ios": "iOS",
  "Ui/Ux": "UI/UX",
  "Ui": "UI",
  "Ux": "UX",
  "Javascript": "JavaScript",
  "Typescript": "TypeScript",
  "Node.Js": "Node.js",
  "Nodejs": "Node.js",
  "Reactjs": "ReactJS",
  "Nextjs": "Next.js",
  "Mysql": "MySQL",
  "Mongodb": "MongoDB",
  "Postgresql": "PostgreSQL",
  "Api": "API",
  "Aws": "AWS",
  "Php": "PHP",
  "Html": "HTML",
  "Css": "CSS",
  "Ai": "AI",
  "Ml": "ML",

  // === FRAMEWORKS, STACKS & LIBRARIES ===
  "Mern": "MERN",
  "Mean": "MEAN",
  "Lamp": "LAMP",
  "Vue.Js": "Vue.js",
  "Vuejs": "Vue.js",
  "Angularjs": "AngularJS",
  "Jquery": "jQuery",
  "Three.Js": "Three.js",
  "Threejs": "Three.js",
  "Nuxt.Js": "Nuxt.js",
  "Nuxtjs": "Nuxt.js",
  "Gatsbyjs": "GatsbyJS",
  "Nestjs": "NestJS",
  "Django": "Django", // Just in case, standard title case handles this fine too!

  // === CLOUD, OPS & PLATFORMS ===
  "Iot": "IoT",
  "Github": "GitHub",
  "Gitlab": "GitLab",
  "Devops": "DevOps",
  "Mlops": "MLOps",
  "Gcp": "GCP",
  "Saas": "SaaS",
  "Paas": "PaaS",
  "Iaas": "IaaS",
  "Vm": "VM",
  "Os": "OS",
  "Vpn": "VPN",
  "Ide": "IDE",
  "Sdk": "SDK",

  // === DATABASES ===
  "Sql": "SQL",
  "Nosql": "NoSQL",
  "Graphql": "GraphQL",
  "Mariadb": "MariaDB",
  "Dynamodb": "DynamoDB",
  "Sqlite": "SQLite",
  
  // === FILE TYPES ===
  "Pdf": "PDF",
  "Json": "JSON",
  "Xml": "XML",
  "Csv": "CSV",
  "Svg": "SVG",
  "Png": "PNG",
  "Jpg": "JPG",
  "Jpeg": "JPEG",
  "Gif": "GIF",

  // === BUSINESS, MARKETING & ANALYTICS ===
  "Hr": "HR",
  "Pr": "PR",
  "Qa": "QA",
  "Seo": "SEO",
  "Sem": "SEM",
  "Ppc": "PPC",
  "B2B": "B2B",
  "B2C": "B2C",
  "Roi": "ROI",
  "Kpi": "KPI",
  "Crm": "CRM",
  "Erp": "ERP",

  // === ROLES & TITLES ===
  "Ceo": "CEO",
  "Cto": "CTO",
  "Cfo": "CFO",
  "Coo": "COO",
  "Cmo": "CMO",
  "Vp": "VP",
  
  // === DEGREES & ACADEMIA ===
  "Mba": "MBA",
  "Bba": "BBA",
  "Btech": "BTech",
  "Mtech": "MTech",
  "Bsc": "BSc",
  "Msc": "MSc",
  "Phd": "PhD",

  // === GRAMMAR & PREPOSITIONS (Lowercases words in the middle of topics) ===
  // E.g. "Data Science And Machine Learning" -> "Data Science and Machine Learning"
  "And": "and",
  "Or": "or",
  "Of": "of",
  "The": "the",
  "In": "in",
  "For": "for",
  "To": "to",
  "With": "with",
  "On": "on",
  "At": "at"
};

// ==========================================
// TITLE CASE FORMATTER
// ==========================================
const toTitleCase = (str) => {
  if (!str) return "";
  
  // 1. Standard Title Case
  let formattedStr = str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());

  // 2. Apply the exact tech branding from the dictionary
  for (const [wrongCase, correctCase] of Object.entries(techExceptions)) {
    const regex = new RegExp(`\\b${wrongCase}\\b`, 'g');
    formattedStr = formattedStr.replace(regex, correctCase);
  }

  // 3. Remove redundant certificate words
  const wordsToRemove = [
    "Internship",
    "Intern",
    "Training",
    "Program",
    "Course",
    "Certification",
    "Certificate"
  ];

  wordsToRemove.forEach(word => {
    // \b ensures we ONLY remove exact matches, keeping names totally safe
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    formattedStr = formattedStr.replace(regex, "");
  });

  // 4. Clean up any double spaces left behind and trim edges
  return formattedStr.replace(/\s+/g, " ").trim();
};

const formatHtmlForLinkedIn = (html) => {
  if (!html) return "";
  let text = html;

  // 1. Preserve paragraph breaks and explicit line breaks
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>|<\/div>/gi, '\n\n');

  // 2. Handle Ordered Lists (Numbers)
  // This looks for <ol> blocks and dynamically numbers the <li> items inside
  text = text.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (match, olContent) => {
    let counter = 1;
    return olContent.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (liMatch, liContent) => {
      return `${counter++}. ${liContent}\n`;
    }) + '\n';
  });

  // 3. Handle Unordered Lists (Bullets)
  // Replaces <li> inside <ul> with clean bullet points
  text = text.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (match, ulContent) => {
    return ulContent.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '• $1\n') + '\n';
  });

  // Fallback for any stray <li> tags
  text = text.replace(/<li[^>]*>/gi, '• ');
  text = text.replace(/<\/li>/gi, '\n');

  // 4. Decode common HTML entities that rich text editors use
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');

  // 5. The Bulldozer: Now it's safe to strip all remaining formatting tags (<b>, <i>, <span>)
  text = text.replace(/<[^>]+>/g, '');

  // 6. Clean up: Ensure we never have more than 2 consecutive line breaks
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
};

module.exports = {
  toTitleCase,
  formatHtmlForLinkedIn
};