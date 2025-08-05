const fs = require("fs");
const {
  companies,
  ALL_COMPANIES,
  getCompanyEmoji,
  getCompanyCareerUrl,
  formatTimeAgo,
  getExperienceLevel,
  getJobCategory,
  formatLocation,
} = require("./utils");
const scrapeAmazonJobs = require('../../../jobboard/src/backend/platforms/amazon/amazonScraper');
const googleScraper = require('../../../jobboard/src/backend/platforms/google/googleScraper');
const scrapeMetaJobs = require('../../../jobboard/src/backend/platforms/meta/metaScraper');
const microsoftScraper = require('../../../jobboard/src/backend/platforms/microsoft/microsoftScraper');

// Generate enhanced job table with better formatting
function generateJobTable(jobs) {
  if (jobs.length === 0) {
    return `| Company | Role | Location | Posted | Level | Category | Apply |
|---------|------|----------|--------|-------|----------|-------|
| *No current openings* | *Check back tomorrow* | *-* | *-* | *-* | *-* | *-* |`;
  }

  // Group jobs by company
  const jobsByCompany = {};
  jobs.forEach((job) => {
    if (!jobsByCompany[job.employer_name]) {
      jobsByCompany[job.employer_name] = [];
    }
    jobsByCompany[job.employer_name].push(job);
  });

  // Sort companies: FAANG+ first, then by job count
  const faangCompanies = companies.faang_plus.map((c) => c.name);
  const sortedCompanies = Object.keys(jobsByCompany).sort((a, b) => {
    const aIsFaang = faangCompanies.includes(a);
    const bIsFaang = faangCompanies.includes(b);

    if (aIsFaang && !bIsFaang) return -1;
    if (!aIsFaang && bIsFaang) return 1;

    return jobsByCompany[b].length - jobsByCompany[a].length;
  });

  let output = "";

  // Show top 5 companies expanded, rest in collapsible sections
  const topCompanies = sortedCompanies.slice(0, 5);
  const remainingCompanies = sortedCompanies.slice(5);

  // Top companies - check if they have more than 50 jobs
  topCompanies.forEach((companyName) => {
    const companyJobs = jobsByCompany[companyName];
    const emoji = getCompanyEmoji(companyName);
    const isFaang = faangCompanies.includes(companyName);
    const tier = isFaang ? "⭐ FAANG+" : "🏢 Top Tech";

    // If company has more than 50 jobs, make it collapsible
    if (companyJobs.length > 50) {
      output += `<details>\n`;
      output += `<summary><h3>${emoji} <strong>${companyName}</strong> (${companyJobs.length} positions) ${tier}</h3></summary>\n\n`;
    } else {
      output += `### ${emoji} **${companyName}** (${companyJobs.length} positions) ${tier}\n\n`;
    }

    output += `| Role | Location | Posted | Level | Category | Apply |\n`;
    output += `|------|----------|--------|-------|----------|-------|\n`;

    companyJobs.forEach((job) => {
      const role = job.job_title;
      const location = formatLocation(job.job_city, job.job_state);
      const posted = formatTimeAgo(job.job_posted_at_datetime_utc);
      const level = getExperienceLevel(job.job_title, job.job_description);
      const category = getJobCategory(job.job_title, job.job_description);
      const applyLink =
        job.job_apply_link || getCompanyCareerUrl(job.employer_name);

      // Add status indicators
      let statusIndicator = "";
      const description = (job.job_description || "").toLowerCase();
      if (
        description.includes("no sponsorship") ||
        description.includes("us citizen")
      ) {
        statusIndicator = " 🇺🇸";
      }
      if (description.includes("remote")) {
        statusIndicator += " 🏠";
      }

      output += `| ${role}${statusIndicator} | ${location} | ${posted} | ${level} | ${category} | [Apply](${applyLink}) |\n`;
    });

    if (companyJobs.length > 50) {
      output += `\n</details>\n\n`;
    } else {
      output += "\n";
    }
  });

  // Remaining companies - collapsible sections
  if (remainingCompanies.length > 0) {
    output += `---\n\n### 📁 **More Companies** (${
      remainingCompanies.length
    } companies, ${remainingCompanies.reduce(
      (sum, c) => sum + jobsByCompany[c].length,
      0
    )} positions)\n\n`;

    remainingCompanies.forEach((companyName) => {
      const companyJobs = jobsByCompany[companyName];
      const emoji = getCompanyEmoji(companyName);
      const isFaang = faangCompanies.includes(companyName);
      const tier = isFaang ? "⭐ FAANG+" : "";

      output += `<details>\n`;
      output += `<summary><strong>${emoji} ${companyName}</strong> (${companyJobs.length} positions) ${tier}</summary>\n\n`;
      output += `| Role | Location | Posted | Level | Category | Apply |\n`;
      output += `|------|----------|--------|-------|----------|-------|\n`;

      companyJobs.forEach((job) => {
        const role = job.job_title;
        const location = formatLocation(job.job_city, job.job_state);
        const posted = formatTimeAgo(job.job_posted_at_datetime_utc);
        const level = getExperienceLevel(job.job_title, job.job_description);
        const category = getJobCategory(job.job_title, job.job_description);
        const applyLink =
          job.job_apply_link || getCompanyCareerUrl(job.employer_name);

        // Add status indicators
        let statusIndicator = "";
        const description = (job.job_description || "").toLowerCase();
        if (
          description.includes("no sponsorship") ||
          description.includes("us citizen")
        ) {
          statusIndicator = " 🇺🇸";
        }
        if (description.includes("remote")) {
          statusIndicator += " 🏠";
        }

        output += `| ${role}${statusIndicator} | ${location} | ${posted} | ${level} | ${category} | [Apply](${applyLink}) |\n`;
      });

      output += `\n</details>\n\n`;
    });
  }

  return output;
}

function generateInternshipSection(internshipData) {
  if (!internshipData) return "";

  return `
---

## 🎓 **2025/2026 Summer Internships** 

> **Fresh internship opportunities for students and upcoming grads**

### 📚 **Top Internship Resources**

| Platform | Type | Description | Link |
|----------|------|-------------|------|
${internshipData.sources
  .map(
    (source) =>
      `| **${source.name}** | ${source.type} | ${source.description} | [Visit](${source.url}) |`
  )
  .join("\n")}

### 🏢 **FAANG+ Internship Programs**

| Company | Program | Application Link | Status |
|---------|---------|------------------|--------|
${internshipData.companyPrograms
  .map((program) => {
    const companyObj = ALL_COMPANIES.find((c) => c.name === program.company);
    const emoji = companyObj ? companyObj.emoji : "🏢";
    return `| ${emoji} **${program.company}** | ${program.program} | [Apply](${program.url}) | ${program.deadline} |`;
  })
  .join("\n")}

`;
}

function generateArchivedSection(archivedJobs, stats) {
  if (archivedJobs.length === 0) return "";

  const archivedFaangJobs = archivedJobs.filter((job) =>
    companies.faang_plus.some((c) => c.name === job.employer_name)
  ).length;

  return `
---

<details>
<summary><h2>🗂️ <strong>ARCHIVED JOBS</strong> - ${
    archivedJobs.length
  } Older Positions (1+ weeks old) - Click to Expand 👆</h2></summary>

### 📊 **Archived Stats**
- **📁 Total Archived**: ${archivedJobs.length} positions
- **🏢 Companies**: ${Object.keys(stats.totalByCompany).length} companies
- **⭐ FAANG+ Archived**: ${archivedFaangJobs} positions
- **📅 Age**: 1+ weeks old

${generateJobTable(archivedJobs)}

### 🏢 **Archived Companies by Category**

#### 🌟 **FAANG+** (Archived)
${companies.faang_plus
  .map((c) => `${c.emoji} [${c.name}](${c.career_url})`)
  .join(" • ")}

#### 🦄 **Unicorn Startups** (Archived)
${companies.unicorn_startups
  .map((c) => `${c.emoji} [${c.name}](${c.career_url})`)
  .join(" • ")}

#### 💰 **Fintech Leaders** (Archived)
${companies.fintech
  .map((c) => `${c.emoji} [${c.name}](${c.career_url})`)
  .join(" • ")}

#### 🎮 **Gaming & Entertainment** (Archived)
${[...companies.gaming, ...companies.media_entertainment]
  .map((c) => `${c.emoji} [${c.name}](${c.career_url})`)
  .join(" • ")}

#### ☁️ **Enterprise & Cloud** (Archived)
${[...companies.top_tech, ...companies.enterprise_saas]
  .map((c) => `${c.emoji} [${c.name}](${c.career_url})`)
  .join(" • ")}

### 📈 **Archived Breakdown by Experience Level**

| Level | Count | Percentage | Top Companies |
|-------|-------|------------|---------------|
| 🟢 **Entry-Level** | ${stats.byLevel["Entry-Level"]} | ${Math.round(
    (stats.byLevel["Entry-Level"] / archivedJobs.length) * 100
  )}% | Perfect for new grads |
| 🟡 **Mid-Level** | ${stats.byLevel["Mid-Level"]} | ${Math.round(
    (stats.byLevel["Mid-Level"] / archivedJobs.length) * 100
  )}% | 2-5 years experience |
| 🔴 **Senior** | ${stats.byLevel["Senior"]} | ${Math.round(
    (stats.byLevel["Senior"] / archivedJobs.length) * 100
  )}% | 5+ years experience |

### 🔍 **Archived Filter by Role Category**

${Object.entries(stats.byCategory)
  .sort((a, b) => b[1] - a[1])
  .map(([category, count]) => {
    const icon =
      {
        "Mobile Development": "📱",
        "Frontend Development": "🎨",
        "Backend Development": "⚙️",
        "Full Stack Development": "🌐",
        "Machine Learning & AI": "🤖",
        "Data Science & Analytics": "📊",
        "DevOps & Infrastructure": "☁️",
        "Security Engineering": "🛡️",
        "Product Management": "📋",
        Design: "🎨",
        "Software Engineering": "💻",
      }[category] || "💻";

    const categoryJobs = archivedJobs.filter(
      (job) => getJobCategory(job.job_title, job.job_description) === category
    );
    const topCompanies = [
      ...new Set(categoryJobs.slice(0, 3).map((j) => j.employer_name)),
    ];

    return `#### ${icon} **${category}** (${count} archived positions)
${topCompanies
  .map((company) => {
    const companyObj = ALL_COMPANIES.find((c) => c.name === company);
    const emoji = companyObj ? companyObj.emoji : "🏢";
    return `${emoji} ${company}`;
  })
  .join(" • ")}`;
  })
  .join("\n\n")}

### 🌍 **Top Archived Locations**

${Object.entries(stats.byLocation)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 8)
  .map(([location, count]) => `- **${location}**: ${count} archived positions`)
  .join("\n")}

</details>

`;
}

// Generate comprehensive README
async function generateReadme(
    dataScienceJobs,
    hardwareJobs,
  currentJobs,
  archivedJobs = [],
  internshipData = null,
  stats = null
) {
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const totalCompanies = Object.keys(stats?.totalByCompany || {}).length;
  const faangJobs = currentJobs.filter((job) =>
    companies.faang_plus.some((c) => c.name === job.employer_name)
  ).length;

  return `# 💼 2026 New Grad Jobs by Zapply

**🚀 Job opportunities from ${totalCompanies}+ top companies • Updated daily • US Positions**

> Fresh software engineering jobs scraped directly from company career pages. Open positions from FAANG, unicorns, and elite startups, updated every 24 hours. **Filtered for US-based positions.**

## 🌟 **Join Our Community**
[![Discord](https://img.shields.io/badge/Discord-Join%20Community-7289DA?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/yKWw28q7Yq)

**💬 [Job Finder & Career Hub by Zapply](https://discord.gg/yKWw28q7Yq)** - Connect with fellow job seekers, get career advice, share experiences, and stay updated on the latest opportunities. Join thousands of developers navigating their career journey together!

${internshipData ? generateInternshipSection(internshipData) : ""}

## 🎯 **Current Opportunities** (Fresh - Less than 1 week old)

${generateJobTable(currentJobs)}

 ## 🖥️ **Hardware Engineering Roles**

 ${generateJobTable(hardwareJobs)}

 ## 📊 **Data Science & Analytics Roles**

${generateJobTable(dataScienceJobs)}

${archivedJobs.length > 0 ? generateArchivedSection(archivedJobs, stats) : ""}

---

## 📊 **Live Stats**
- **🔥 Active Positions**: ${currentJobs.length} 
- **🏢 Companies**: ${totalCompanies} elite tech companies
- **⭐ FAANG+ Jobs**: ${faangJobs} premium opportunities  
- **📅 Last Updated**: ${currentDate}
- **🤖 Next Update**: Tomorrow at 9 AM UTC
- **📁 Archived Jobs**: ${archivedJobs.length} (older than 1 week)

---

## 🏢 **Companies by Category**

### 🌟 **FAANG+** (${companies.faang_plus.length} companies)
${companies.faang_plus
  .map((c) => `${c.emoji} [${c.name}](${c.career_url})`)
  .join(" • ")}

### 🦄 **Unicorn Startups** (${companies.unicorn_startups.length} companies) 
${companies.unicorn_startups
  .map((c) => `${c.emoji} [${c.name}](${c.career_url})`)
  .join(" • ")}

### 💰 **Fintech Leaders** (${companies.fintech.length} companies)
${companies.fintech
  .map((c) => `${c.emoji} [${c.name}](${c.career_url})`)
  .join(" • ")}

### 🎮 **Gaming & Entertainment** (${
    [...companies.gaming, ...companies.media_entertainment].length
  } companies)
${[...companies.gaming, ...companies.media_entertainment]
  .map((c) => `${c.emoji} [${c.name}](${c.career_url})`)
  .join(" • ")}

### ☁️ **Enterprise & Cloud** (${
    [...companies.top_tech, ...companies.enterprise_saas].length
  } companies)
${[...companies.top_tech, ...companies.enterprise_saas]
  .map((c) => `${c.emoji} [${c.name}](${c.career_url})`)
  .join(" • ")}

---

## 📈 **Breakdown by Experience Level**

| Level | Count | Percentage | Top Companies |
|-------|-------|------------|---------------|
| 🟢 **Entry-Level** | ${stats?.byLevel["Entry-Level"] || 0} | ${
    stats
      ? Math.round((stats.byLevel["Entry-Level"] / currentJobs.length) * 100)
      : 0
  }% | Perfect for new grads |
| 🟡 **Mid-Level** | ${stats?.byLevel["Mid-Level"] || 0} | ${
    stats
      ? Math.round((stats.byLevel["Mid-Level"] / currentJobs.length) * 100)
      : 0
  }% | 2-5 years experience |
| 🔴 **Senior** | ${stats?.byLevel["Senior"] || 0} | ${
    stats ? Math.round((stats.byLevel["Senior"] / currentJobs.length) * 100) : 0
  }% | 5+ years experience |

---

## 🔍 **Filter by Role Category**

${
  stats
    ? Object.entries(stats.byCategory)
        .sort((a, b) => b[1] - a[1])
        .map(([category, count]) => {
          const icon =
            {
              "Mobile Development": "📱",
              "Frontend Development": "🎨",
              "Backend Development": "⚙️",
              "Full Stack Development": "🌐",
              "Machine Learning & AI": "🤖",
              "Data Science & Analytics": "📊",
              "DevOps & Infrastructure": "☁️",
              "Security Engineering": "🛡️",
              "Product Management": "📋",
              Design: "🎨",
              "Software Engineering": "💻",
            }[category] || "💻";

          const categoryJobs = currentJobs.filter(
            (job) =>
              getJobCategory(job.job_title, job.job_description) === category
          );
          const topCompanies = [
            ...new Set(categoryJobs.slice(0, 3).map((j) => j.employer_name)),
          ];

          return `### ${icon} **${category}** (${count} positions)
${topCompanies
  .map((company) => {
    const companyObj = ALL_COMPANIES.find((c) => c.name === company);
    const emoji = companyObj ? companyObj.emoji : "🏢";
    return `${emoji} ${company}`;
  })
  .join(" • ")}`;
        })
        .join("\n\n")
    : ""
}

---

## 🌍 **Top Locations**

${
  stats
    ? Object.entries(stats.byLocation)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([location, count]) => `- **${location}**: ${count} positions`)
        .join("\n")
    : ""
}

---

## 🚀 **Application Tips**

### 📝 **Before Applying**
- Research the company's recent news and products
- Tailor your resume to the specific role requirements
- Check if you meet the visa/citizenship requirements (🇺🇸 indicator)
- Look up the hiring manager or team on LinkedIn

### 💡 **Stand Out Tips**
- Include relevant projects that match the tech stack
- Show impact with metrics (improved performance by X%, built feature used by Y users)
- Demonstrate knowledge of the company's products/mission
- Prepare for technical interviews with company-specific questions

---

## 📬 **Stay Updated**

- **⭐ Star this repo** to bookmark for daily checking
- **👀 Watch** to get notified of new opportunities
- **🔔 Enable notifications** for instant updates
- **📱 Bookmark on mobile** for quick job hunting

---

## 🤝 **Contributing**

Spotted an issue or want to suggest improvements?
- 🐛 **Report bugs** in the Issues tab
- 💡 **Suggest companies** to add to our tracking list
- 🔗 **Submit corrections** for broken links
- ⭐ **Star the repo** to support the project

---

<div align="center">

**🎯 ${
    currentJobs.length
  } current opportunities from ${totalCompanies} elite companies**

**Found this helpful? Give it a ⭐ to support Zapply!**

*Not affiliated with any companies listed. All applications redirect to official career pages.*

---

**Last Updated**: ${currentDate} • **Next Update**: Daily at 9 AM UTC

</div>`;
}

// Update README file
async function updateReadme(currentJobs, archivedJobs, internshipData, stats) {
  try {
    console.log("📝 Generating README content...");
    allHardwarejobs = [];
    allDataScienceJobs = [];
    const [
      amazon_Hardware,
      meta_Hardware,
      microsoft_Hardware,
      google_Hardware,
    ] = await Promise.all([
      scrapeAmazonJobs("hardware engineering"),
      scrapeMetaJobs("hardware engineering"),
      microsoftScraper("hardware engineering"),
      googleScraper("Hardware Engineering"),
    ]);
    allHardwarejobs.push(
      ...amazon_Hardware,
      ...meta_Hardware,
      ...microsoft_Hardware,
      ...google_Hardware
    );
    const [
      amazon_DataScience,
      meta_DataScience,
      microsoft_DataScience,
      google_DataScience,
    ] = await Promise.all([
      scrapeAmazonJobs("Data Science"),
      scrapeMetaJobs("Data Science"),
      microsoftScraper("data science"),
      googleScraper("Data Science"),
    ]);
    allDataScienceJobs.push(
      ...amazon_DataScience,
      ...meta_DataScience,
      ...microsoft_DataScience,
      ...google_DataScience
    );
    const readmeContent = await generateReadme(
      allDataScienceJobs,
      allHardwarejobs,
      currentJobs,
      archivedJobs,
      internshipData,
      stats
    );
    fs.writeFileSync("README.md", readmeContent, "utf8");
    console.log(`✅ README.md updated with ${currentJobs.length} current jobs`);

    console.log("\n📊 Summary:");
    console.log(`- Total current: ${currentJobs.length}`);
    console.log(`- Archived:      ${archivedJobs.length}`);
    console.log(
      `- Companies:     ${Object.keys(stats?.totalByCompany || {}).length}`
    );
  } catch (err) {
    console.error("❌ Error updating README:", err);
    throw err;
  }
}

module.exports = {
  generateJobTable,
  generateInternshipSection,
  generateArchivedSection,
  generateReadme,
  updateReadme,
};
