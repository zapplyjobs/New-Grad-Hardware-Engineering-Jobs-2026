const fs = require("fs");
const companyCategory = require("./hardware.json");

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

function generateJobTable(jobs) {
  console.log(
    `🔍 DEBUG: Starting generateJobTable with ${jobs.length} total jobs`
  );

  if (jobs.length === 0) {
    return `| Company | Role | Location | Apply Now | Age |
|---------|------|----------|-----------|-----|
| *No current openings* | *Check back tomorrow* | *-* | *-* | *-* |`;
  }

  // Create a map of lowercase company names to actual names for case-insensitive matching
  const companyNameMap = new Map();
  Object.entries(companyCategory).forEach(([categoryKey, category]) => {
    category.companies.forEach((company) => {
      companyNameMap.set(company.toLowerCase(), {
        name: company,
        category: categoryKey,
        categoryTitle: category.title,
      });
    });
  });

  console.log(`🏢 DEBUG: Configured companies by category:`);
  Object.entries(companyCategory).forEach(([categoryKey, category]) => {
    console.log(
      `  ${category.emoji} ${category.title}: ${category.companies.join(", ")}`
    );
  });

  // Get unique companies from job data
  const uniqueJobCompanies = [...new Set(jobs.map((job) => job.employer_name))];
  console.log(
    `\n📊 DEBUG: Unique companies found in job data (${uniqueJobCompanies.length}):`,
    uniqueJobCompanies
  );

  // Group jobs by company - only include jobs from valid companies
  const jobsByCompany = {};
  const processedCompanies = new Set();
  const skippedCompanies = new Set();

  jobs.forEach((job) => {
    const employerNameLower = job.employer_name.toLowerCase();
    const matchedCompany = companyNameMap.get(employerNameLower);

    // Only process jobs from companies in our category list
    if (matchedCompany) {
      processedCompanies.add(job.employer_name);
      if (!jobsByCompany[matchedCompany.name]) {
        jobsByCompany[matchedCompany.name] = [];
      }
      jobsByCompany[matchedCompany.name].push(job);
    } else {
      skippedCompanies.add(job.employer_name);
    }
  });

  console.log(`\n✅ DEBUG: Companies INCLUDED (${processedCompanies.size}):`, [
    ...processedCompanies,
  ]);
  console.log(`\n❌ DEBUG: Companies SKIPPED (${skippedCompanies.size}):`, [
    ...skippedCompanies,
  ]);

  // Log job counts by company
  console.log(`\n📈 DEBUG: Job counts by company:`);
  Object.entries(jobsByCompany).forEach(([company, jobs]) => {
    const companyInfo = companyNameMap.get(company.toLowerCase());
    console.log(
      `  ${company}: ${jobs.length} jobs (Category: ${
        companyInfo?.categoryTitle || "Unknown"
      })`
    );
  });

  let output = "";

  // Handle each category
  Object.entries(companyCategory).forEach(([categoryKey, categoryData]) => {
    // Filter companies that actually have jobs
    const companiesWithJobs = categoryData.companies.filter(
      (company) => jobsByCompany[company] && jobsByCompany[company].length > 0
    );

    if (companiesWithJobs.length > 0) {
      const totalJobs = companiesWithJobs.reduce(
        (sum, company) => sum + jobsByCompany[company].length,
        0
      );

      console.log(
        `\n📝 DEBUG: Processing category "${categoryData.title}" with ${companiesWithJobs.length} companies and ${totalJobs} total jobs:`
      );
      companiesWithJobs.forEach((company) => {
        console.log(`  - ${company}: ${jobsByCompany[company].length} jobs`);
      });

      // Use singular/plural based on job count
      const positionText = totalJobs === 1 ? "position" : "positions";
      output += `### ${categoryData.emoji} **${categoryData.title}** (${totalJobs} ${positionText})\n\n`;

      // Handle ALL companies with their own sections (regardless of job count)
      companiesWithJobs.forEach((companyName) => {
        const companyJobs = jobsByCompany[companyName];
        const emoji = getCompanyEmoji(companyName);
        const positionText =
          companyJobs.length === 1 ? "position" : "positions";

        // Use collapsible details for companies with more than 15 jobs
        if (companyJobs.length > 15) {
          output += `<details>\n`;
          output += `<summary><h4>${emoji} <strong>${companyName}</strong> (${companyJobs.length} ${positionText})</h4></summary>\n\n`;
        } else {
          output += `#### ${emoji} **${companyName}** (${companyJobs.length} ${positionText})\n\n`;
        }

        output += `| Role | Location | Apply Now | Age |\n`;
        output += `|------|----------|-----------|-----|\n`;

        companyJobs.forEach((job) => {
          const role = job.job_title;
          const location = formatLocation(job.job_city, job.job_state);
          const posted = job.job_posted_at;
          const applyLink =
            job.job_apply_link || getCompanyCareerUrl(job.employer_name);

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

          output += `| ${role}${statusIndicator} | ${location} | [<img src="./image.png" width="100" alt="Apply">](${applyLink}) | ${posted} |\n`;
        });

        if (companyJobs.length > 15) {
          output += `\n</details>\n\n`;
        } else {
          output += "\n";
        }
      });
    }
  });

  console.log(
    `\n🎉 DEBUG: Finished generating job table with ${
      Object.keys(jobsByCompany).length
    } companies processed`
  );
  return output;
}


function generateArchivedSection(archivedJobs, stats) {
  if (archivedJobs.length === 0) return "";

  const archivedFaangJobs = archivedJobs.filter((job) =>
    companies.faang_plus.some((c) => c.name === job.employer_name)
  ).length;

  return `
---

<details>
<summary><h2>📁 <strong>Archived SWE Jobs</strong> - ${
    archivedJobs.length
  } (7+ days old) - Click to Expand</h2></summary>

> Either still hiring or useful for research.

### **Archived Job Stats**
- **📁 Total Jobs**: ${archivedJobs.length} positions
- **🏢 Companies**: ${Object.keys(stats.totalByCompany).length} companies  
- **⭐ FAANG+ Jobs & Internships**: ${archivedFaangJobs} roles

${generateJobTable(archivedJobs)}

</details>

---

`;
}

// Generate comprehensive README
async function generateReadme(
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

> Fresh hardware engineering jobs scraped directly from company career pages. Open positions from FAANG, unicorns, and elite startups, updated every 10 minutes. **Filtered for US-based positions.**

## 🌟 **Join Our Community**
- Connect with fellow job seekers, get career advice, share experiences, and stay updated on the latest opportunities. Join thousands of developers navigating their career journey together!

 <div align="center">
  <a href="https://discord.gg/yKWw28q7Yq" target="_blank">
    <img src="./discord-button.png" width="400" alt="Join Discord - Job Finder & Career Hub by Zapply">
  </a>
</div>


---

## 📊 **Live Stats**
- **🔥 Active Positions**: ${currentJobs.length} 
- **🏢 Companies**: ${totalCompanies} elite tech companies
- **⭐ FAANG+ Jobs**: ${faangJobs} premium opportunities  
- **📅 Last Updated**: ${currentDate}
- **🤖 Next Update**: Tomorrow at 9 AM UTC
- **📁 Archived Jobs**: ${archivedJobs.length} (older than 1 week)


---


## 🎯 **Fresh Hardware Job Listings 2026 (under 1 week)**

${generateJobTable(currentJobs)}


---
## **✨ Insights on the Repo**

### 🏢 **Top Companies**

#### ⭐ **FAANG+** (${(() => {
  const count = companies?.faang_plus?.filter(c => currentJobs.filter(job => job.employer_name === c.name).length > 0).length || 0;
  return `${count} ${count === 1 ? 'company' : 'companies'}`;
})()})
${companies?.faang_plus?.filter(c => currentJobs.filter(job => job.employer_name === c.name).length > 0).map((c, index) => {
  const totalJobs = currentJobs.filter(job => job.employer_name === c.name).length;
  const jobText = totalJobs === 1 ? 'position' : 'positions';
  if (index === 0) {
    return `${c.emoji} **[${c.name}](${c.career_url})** (${totalJobs} ${jobText})`;
  } else {
    return `${c.emoji} **[${c.name}](${c.career_url})** (${totalJobs})`;
  }
}).join(" • ") || "No companies available"}


#### 💰 **Fintech Leaders** (${(() => {
  const count = companies?.fintech?.filter(c => currentJobs.filter(job => job.employer_name === c.name).length > 0).length || 0;
  return `${count} ${count === 1 ? 'company' : 'companies'}`;
})()})
${companies?.fintech?.filter(c => currentJobs.filter(job => job.employer_name === c.name).length > 0).map((c, index) => {
  const totalJobs = currentJobs.filter(job => job.employer_name === c.name).length;
  const jobText = totalJobs === 1 ? 'position' : 'positions';
  if (index === 0) {
    return `${c.emoji} **[${c.name}](${c.career_url})** (${totalJobs} ${jobText})`;
  } else {
    return `${c.emoji} **[${c.name}](${c.career_url})** (${totalJobs})`;
  }
}).join(" • ") || "No companies available"}


#### ☁️ **Enterprise & Cloud** (${(() => {
  const count = [...(companies?.enterprise_saas || []), ...(companies?.top_tech || [])].filter(c => currentJobs.filter(job => job.employer_name === c.name).length > 0).length || 0;
  return `${count} ${count === 1 ? 'company' : 'companies'}`;
})()})
${[...(companies?.enterprise_saas || []), ...(companies?.top_tech || [])].filter(c => currentJobs.filter(job => job.employer_name === c.name).length > 0).map((c, index) => {
  const totalJobs = currentJobs.filter(job => job.employer_name === c.name).length;
  const jobText = totalJobs === 1 ? 'position' : 'positions';
  if (index === 0) {
    return `${c.emoji} **[${c.name}](${c.career_url})** (${totalJobs} ${jobText})`;
  } else {
    return `${c.emoji} **[${c.name}](${c.career_url})** (${totalJobs})`;
  }
}).join(" • ") || "No companies available"}

---

### 📈 **Experience Breakdown**

| Level               | Count | Percentage | Top Companies                     |
|---------------------|-------|------------|-----------------------------------|
| 🟢 Entry Level & New Grad | ${stats?.byLevel["Entry-Level"] || 0} | ${
    stats
      ? Math.round((stats.byLevel["Entry-Level"] / currentJobs.length) * 100)
      : 0
  }% | No or minimal experience |
| 🟡 Beginner & Early Career | ${stats?.byLevel["Mid-Level"] || 0} | ${
    stats
      ? Math.round((stats.byLevel["Mid-Level"] / currentJobs.length) * 100)
      : 0
  }% | 1-2 years of experience |
| 🔴 Manager         | ${stats?.byLevel["Senior"] || 0} | ${
    stats ? Math.round((stats.byLevel["Senior"] / currentJobs.length) * 100) : 0
  }% | 2+ years of experience |

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

## 🔮 **Why Hardware Engineers Choose Our Job Board**

✅ **100% Real Jobs:** ${
    currentJobs.length
  }+ verified CS internships and entry-level hardware roles from ${totalCompanies} elite tech companies.

✅ **Fresh Daily Updates:** Live company data from Tesla, Raytheon, Chewy, and CACI refreshed every 10 minutes automatically.

✅ **Entry-Level Focused:** Smart filtering for CS majors, new grads, and early-career engineers.

✅ **Intern-to-FTE Pipeline:** Track internships that convert to full-time Hardware Engineering roles.

✅ **Direct Applications:** Skip recruiters -- apply straight to company career pages for Tesla, Amazon, and NVIDIA positions.

✅ **Mobile-Optimized:** Perfect mobile experience for CS students job hunting between classes.

---

## 🚀 **Job Hunt Tips That Actually Work**

### 🔍 **Research Before Applying**

- **Find the hiring manager:** Search "[Company] [Team] engineering manager" on LinkedIn.
- **Check recent tech decisions:** Read their engineering blog for stack changes or new initiatives.
- **Verify visa requirements:** Look for 🇺🇸 indicator or "US persons only" in job description.
- [Use this 100% ATS-compliant and job-targeted resume template](https://docs.google.com/document/d/1EcP_vX-vTTblCe1hYSJn9apwrop0Df7h/export?format=docx).

### 📄 **Resume Best Practices**

- **Mirror their tech stack:** Copy exact keywords from job post (React, Django, Node.js, etc.).
- **Lead with business impact:** "Improved app speed by 30%" > "Used JavaScript."
- **Show product familiarity:** "Built Netflix-style recommendation engine" or "Created Stripe payment integration."
- [Read this informative guide on tweaking your resume](https://drive.google.com/uc?export=download&id=1H6ljywqVnxONdYUD304V1QRayYxr0D1e).

### 🎯 **Interview Best Practices**

- **Ask tech-specific questions:** "How do you handle CI/CD at scale?" shows real research.
- **Prepare failure stories:** "Migration failed, learned X, rebuilt with Y" demonstrates growth mindset.
- **Reference their products:** "As a daily Slack user, I've noticed..." proves genuine interest.
- [Review this comprehensive interview guide on common behavioral, technical, and curveball questions](https://drive.google.com/uc?export=download&id=1MGRv7ANu9zEnnQJv4sstshsmc_Nj0Tl0).

---

## 📬 **Stay Updated**

- ⭐ **Star this repo** to bookmark and check daily.
- 👀 **Watch** to get notified of new SWE jobs.
- 📱 **Bookmark on your phone** for quick job hunting.
- 🤝 **Become a contributor** and add new jobs! Visit our CONTRIBUTING GUIDE [here](CONTRIBUTING-GUIDE.md).

---


${archivedJobs.length > 0 ? generateArchivedSection(archivedJobs, stats) : ""}


<div align="center">

**🎯 ${
    currentJobs.length
  } current opportunities from ${totalCompanies} elite companies.**

**Found this helpful? Give it a ⭐ to support us!**

*Not affiliated with any companies listed. All applications redirect to official career pages.*

---

**Last Updated:** ${currentDate} • **Next Update:** Daily at 9 AM UTC

</div>`;
}


// Update README file
async function updateReadme(currentJobs, archivedJobs, internshipData, stats) {
  try {
    console.log("📝 Generating README content...");
    const readmeContent = await generateReadme(
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
  generateArchivedSection,
  generateReadme,
  updateReadme,
};





