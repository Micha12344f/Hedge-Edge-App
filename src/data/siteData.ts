export const brokersData = [
  {
    id: 1,
    name: "Alpha Prop Trading",
    logo: "APT",
    description: "Industry-leading prop firm with flexible rules and fast payouts",
    minDeposit: "$0",
    maxDrawdown: "10%",
    profitSplit: "80/20",
    features: ["Daily payouts", "No time limits", "Scale to $2M"],
    hasRebate: true,
  },
  {
    id: 2,
    name: "Apex Trader Funding",
    logo: "ATF",
    description: "Trusted platform with multiple account sizes and evaluation paths",
    minDeposit: "$0",
    maxDrawdown: "8%",
    profitSplit: "90/10",
    features: ["Weekly payouts", "One-step evaluation", "Mobile trading"],
    hasRebate: true,
  },
  {
    id: 3,
    name: "FTMO",
    logo: "FTM",
    description: "Established European firm with rigorous but rewarding programs",
    minDeposit: "$0",
    maxDrawdown: "10%",
    profitSplit: "80/20",
    features: ["Bi-weekly payouts", "Two-step challenge", "Scaling plan"],
    hasRebate: true,
  },
];

export const tiersData = [
  {
    name: "Free Guide",
    price: "Free",
    description: "Essential hedge strategies & vetted broker list",
    features: [
      "Complete PDF guide on hedging",
      "Vetted broker comparison list",
      "Discord community access",
      "Weekly market insights",
    ],
    cta: "Download Now",
    ctaLink: "/learn",
    popular: false,
  },
  {
    name: "1-on-1 Consult",
    price: "$99",
    description: "Personalized strategy session with expert guidance",
    features: [
      "60-minute strategy call",
      "Custom hedge plan review",
      "Broker selection guidance",
      "Risk management analysis",
      "Follow-up email support",
    ],
    cta: "Book Consultation",
    ctaLink: "/consult",
    popular: true,
  },
  {
    name: "Full Automation",
    price: "$599",
    description: "Done-for-you hedge setup & ongoing management",
    features: [
      "Complete account setup",
      "Custom algorithm development",
      "24/7 automated monitoring",
      "Monthly optimization calls",
      "Priority support access",
    ],
    cta: "Start Automation",
    ctaLink: "/automation",
    popular: false,
  },
];

export const faqData = [
  {
    q: "Is this investment advice?",
    a: "No. We provide educational content and tools only. All trading decisions are your own responsibility. Consult a licensed financial advisor for personalized investment advice.",
  },
  {
    q: "How do prop firm hedging strategies work?",
    a: "Hedging involves taking offsetting positions to manage risk across accounts. Our guides explain various strategies, but outcomes depend entirely on prop firm rules, market conditions, and your execution.",
  },
  {
    q: "Do you guarantee profits?",
    a: "Absolutely not. Trading involves substantial risk. Our tools and education aim to help you understand strategies, but we make no guarantees about outcomes.",
  },
  {
    q: "What about the broker rebates?",
    a: "We may receive small per-lot rebates from brokers when you use our referral links. This doesn't cost you anything extra and helps support our educational content.",
  },
  {
    q: "Can I get a refund?",
    a: "Consultation and automation fees are non-refundable once services are rendered, as they involve personalized time and setup. The free guide is always available at no cost.",
  },
];

export const automationFeatures = [
  "Full account setup & configuration",
  "Custom algorithm development",
  "Broker integration & API setup",
  "24/7 automated monitoring",
  "Monthly optimization calls",
  "Real-time alerts & reporting",
  "Priority technical support",
  "90-day performance tracking",
];

export const legalContent = {
  terms: {
    title: "Terms of Service",
    sections: [
      {
        heading: "Acceptance of Terms",
        text: "By accessing HedgeEdge, you agree to these Terms of Service. If you do not agree, please discontinue use immediately.",
      },
      {
        heading: "Educational Purpose Only",
        text: "All content, tools, and services provided are for educational purposes only. We do not provide investment advice, financial planning, or recommendations to buy or sell securities.",
      },
      {
        heading: "No Guarantees",
        text: "We make no guarantees or warranties about trading outcomes, profitability, or success. Trading involves substantial risk of loss. Past performance does not indicate future results.",
      },
      {
        heading: "Third-Party Relationships",
        text: "We may recommend third-party prop firms and brokers. Your relationship with these entities is independent. We are not responsible for their actions, policies, or rule changes.",
      },
      {
        heading: "Service Modifications",
        text: "We reserve the right to modify, suspend, or discontinue any service at any time without notice. Fees are non-refundable once services are rendered.",
      },
      {
        heading: "User Responsibilities",
        text: "You are responsible for maintaining account security, complying with all applicable laws, and ensuring your trading activities comply with prop firm rules.",
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    sections: [
      {
        heading: "Information We Collect",
        text: "We collect email addresses, names, and payment information necessary to provide our services. We may also collect usage data and analytics to improve our platform.",
      },
      {
        heading: "How We Use Your Information",
        text: "Your information is used to deliver services, send educational content, process payments, and communicate important updates. We never sell personal data to third parties.",
      },
      {
        heading: "Third-Party Services",
        text: "We use Stripe for payment processing and may use email service providers. These partners have their own privacy policies and data handling practices.",
      },
      {
        heading: "Data Security",
        text: "We implement industry-standard security measures to protect your data. However, no method of transmission over the internet is 100% secure.",
      },
      {
        heading: "Your Rights",
        text: "You have the right to access, correct, or delete your personal information. Contact us to exercise these rights or for data-related questions.",
      },
      {
        heading: "Updates to This Policy",
        text: "We may update this Privacy Policy periodically. Continued use after changes constitutes acceptance of the updated policy.",
      },
    ],
  },
  risk: {
    title: "Risk Disclosure",
    sections: [
      {
        heading: "Trading Risks",
        text: "Trading futures, forex, and other leveraged instruments involves substantial risk of loss. You may lose more than your initial investment. Only trade with capital you can afford to lose.",
      },
      {
        heading: "Prop Firm Risks",
        text: "Prop firm outcomes depend entirely on firm rules, your trading performance, and market conditions. Firms may change rules, deny payouts, or terminate accounts at their discretion.",
      },
      {
        heading: "Hedging Strategy Risks",
        text: "Hedging strategies do not eliminate risk. Correlated positions may move against you simultaneously. Brokers may have anti-hedging policies or restrictions.",
      },
      {
        heading: "Technology Risks",
        text: "Automated systems can fail due to technical issues, connectivity problems, or bugs. Always monitor automated strategies and have contingency plans.",
      },
      {
        heading: "No Investment Advice",
        text: "Nothing on this platform constitutes investment advice. We provide education and tools only. Consult licensed financial professionals for personalized advice.",
      },
      {
        heading: "Regulatory Disclaimer",
        text: "We are not a registered investment advisor, broker-dealer, or financial institution. Users are responsible for ensuring compliance with their local regulations.",
      },
    ],
  },
  cookies: {
    title: "Cookie Policy",
    sections: [
      {
        heading: "What Are Cookies",
        text: "Cookies are small text files stored on your device that help us provide and improve our services, remember your preferences, and analyze site usage.",
      },
      {
        heading: "Types of Cookies We Use",
        text: "Essential cookies enable core functionality. Analytics cookies help us understand how you use our site. We do not use advertising or tracking cookies.",
      },
      {
        heading: "Third-Party Cookies",
        text: "Some cookies may be set by third-party services we use, such as analytics providers. These are governed by the respective third party privacy policies.",
      },
      {
        heading: "Managing Cookies",
        text: "You can control cookies through your browser settings. Disabling cookies may limit some site functionality but will not prevent access to content.",
      },
      {
        heading: "Cookie Duration",
        text: "Session cookies expire when you close your browser. Persistent cookies remain for a set period to remember your preferences across visits.",
      },
    ],
  },
};
