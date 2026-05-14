# Code of Conduct

## Our Pledge

We, as members, contributors, and leaders of the **Reshma‑Core** community, pledge to make participation in our project and our community a harassment‑free experience for everyone – regardless of age, body size, visible or invisible disability, ethnicity, sex characteristics, gender identity and expression, level of experience, education, socio‑economic status, nationality, personal appearance, race, caste, colour, religion, or sexual identity and orientation.

We are committed to building a **highly scalable, secure e‑commerce engine** that powers real businesses. We believe the best technical solutions arise from diverse, respectful, and open collaboration. Therefore, we hold ourselves and each other to the highest standards of behaviour – both online and offline.

---

## Our Standards

### Positive, Contributing Behaviour

Examples of behaviour that fosters a positive and productive environment:

- **Using welcoming and inclusive language** – everyone is a potential contributor, regardless of their background or skill level.
- **Being respectful of differing viewpoints and experiences** – we learn from each other.
- **Focusing on what is best for the long‑term maintainability, security, and performance of the codebase** – not on personal preferences or ego.
- **Proactively helping newer contributors** understand the system architecture, our strict TypeScript rules, Zod validation, and Docker setup.
- **Gracefully accepting constructive criticism** – code reviews are about the code, not the coder.
- **Prioritising security** – if you see a potential vulnerability (e.g., missing Zod validation, raw `req.body` access, or an `any` type), speak up respectfully.

### Unacceptable Behaviour

Examples of unacceptable behaviour include:

- **Trolling, insulting or derogatory comments**, and personal or political attacks.
- **Public or private harassment** – including repeated unsolicited contact, stalking, or intimidation.
- **Publishing others’ private information** (e.g., physical or email addresses, API keys, database passwords) without explicit permission.
- **Dismissive language during technical debates** – e.g., “that’s a stupid idea” instead of “I see a potential issue with that approach because …”.
- **Attempting to merge malicious, obfuscated, or intentionally vulnerable code** – this includes introducing backdoors, disabling security checks, or circumventing validation.
- **Using the issue tracker or pull requests to spam, advertise, or promote unrelated products**.
- **Disrespecting the project’s security policy** – e.g., publicly disclosing a vulnerability without following [SECURITY.md](./SECURITY.md).

### Code Review Etiquette (The Egoless Engineering Rule)

We critique the **code**, not the **coder**. Technical discussions must remain objective, focused on architecture, scalability, security, and maintainability.

**For reviewers:**
- Ask questions rather than making demands.  
  “What are your thoughts on using a Zod union here to handle both guest and registered user payloads?”  
  “This validation is wrong – change it.”
- Always provide the **architectural reasoning** behind requested changes (e.g., “We need strict typing here because the payment webhook is a common injection point.”).
- Recognise that there are often multiple valid solutions – suggest improvements without belittling the original approach.

**For contributors:**
- Do not take architectural feedback or code rejection personally. Our strict `noImplicitAny`, Zod validation, and security checks exist to protect the production system, not to gatekeep contributions.
- If you disagree with feedback, provide **technical counter‑arguments** with evidence (e.g., benchmarks, security references, official documentation).
- Always assume good faith – your reviewer is trying to make the codebase better, not attack you.

---

## Enforcement Responsibilities

Project maintainers are responsible for clarifying the standards of acceptable behaviour and will take appropriate and fair corrective action in response to any instances of unacceptable behaviour.

Maintainers have the right and responsibility to **remove, edit, or reject** comments, commits, code, wiki edits, issues, and other contributions that are not aligned with this Code of Conduct. They may also **temporarily or permanently ban** any contributor for behaviours they deem inappropriate, threatening, offensive, or harmful.

### Enforcement Priorities

1. **Immediate safety** – any threat, harassment, or doxxing will result in an instant permanent ban.
2. **Preserving a productive technical environment** – repeated dismissiveness, trolling, or refusal to follow coding standards will lead to a warning, then a temporary ban, then a permanent ban.
3. **Protecting the project’s security** – attempting to bypass security measures (e.g., disabling rate limiting, removing Zod validation) will be treated as a severe violation.

---

## Reporting Guidelines

If you experience or witness unacceptable behaviour – or have any other concerns – please report it by contacting the project team directly:

- **Email:** `mdafzal14777@gmail.com` (preferred for sensitive or private reports)
- **GitHub:** You can also DM a maintainer (if you have a pre‑existing relationship) or use the “Report abuse” feature on a comment/issue.

All complaints will be **reviewed and investigated** promptly and fairly. The project team is obligated to **maintain confidentiality** with regard to the reporter of an incident.

When reporting, please include:
- Your contact information (optional but helpful)
- A description of the incident (what happened, when, where)
- Any relevant screenshots, links, or logs
- Any other context that might help us understand the situation

We will respond within **48 hours** acknowledging receipt of the report, and we will provide a timeline for resolution.

---

## Scope

This Code of Conduct applies within **all project spaces** – including the GitHub repository (issues, pull requests, discussions, wiki), community Discord/Slack channels (if created), and public spaces (e.g., conferences, meetups) when an individual is representing the project or its community.

Representation includes using an official project email address, posting via an official social media account, or acting as an appointed representative at an online or offline event.

---

## Attribution

This Code of Conduct is adapted from the [Contributor Covenant](https://www.contributor-covenant.org), version 2.1, available at [https://www.contributor-covenant.org/version/2/1/code_of_conduct.html](https://www.contributor-covenant.org/version/2/1/code_of_conduct.html).  

We have added specific sections on **Code Review Etiquette** and **Security‑focused enforcement** to reflect the needs of a production e‑commerce backend.

---

## Contact & Questions

For any questions about this Code of Conduct, please email `mdafzal14777@gmail.com`.  
We are committed to maintaining a safe, inclusive, and technically excellent community around Reshma‑Core.

---

*Last updated: 2025-04-08*  
*Version: 2.0*  
