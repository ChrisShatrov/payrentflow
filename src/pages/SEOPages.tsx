import { SEOLandingPage } from "@/components/SEOLandingPage";

// Tenant Intent Pages (High Volume)
export const PayRentOnline = () => (
    <SEOLandingPage
      title="Pay Rent Online — RentFlow | Secure Online Rent Payment Platform"
      description="Pay rent online securely with RentFlow. Accept credit cards, debit cards, and ACH transfers. Automated reminders and late fee calculations. Get started free."
      canonicalUrl="https://www.payrentflow.com/pay-rent-online"
      h1="Pay Rent Online — Fast, Secure, and Easy"
      introParagraphs={[
        "Paying rent has never been easier. With RentFlow, tenants can pay rent online using credit cards, debit cards, or bank transfers (ACH). No more checks, no more trips to the bank—just simple, secure online payments.",
        "Our platform automatically sends payment reminders, calculates late fees, and provides instant payment confirmations. Landlords receive payments directly to their bank account, and tenants get peace of mind with bank-level security.",
      ]}
      featureBullets={[
        "Pay with credit card, debit card, or bank transfer (ACH)",
        "Automatic payment reminders sent via email",
        "Instant payment confirmations and receipts",
        "Bank-level security and encryption",
        "24/7 payment processing—pay anytime, anywhere",
        "Automatic late fee calculations and notifications",
      ]}
      faqs={[
        {
          question: "How do I pay rent online?",
          answer: "Simply log in to your tenant portal, view your current statement, and click 'Pay'. You can choose to pay with a credit card, debit card, or bank transfer. Payments are processed securely and you'll receive an instant confirmation.",
        },
        {
          question: "Are there fees for paying rent online?",
          answer: "Credit card payments have a small processing fee (typically 3.75%), while ACH bank transfers have a flat $5 fee. These fees are clearly displayed before you complete your payment.",
        },
        {
          question: "How quickly do landlords receive payments?",
          answer: "ACH bank transfers typically take 2-3 business days to process. Credit and debit card payments are processed immediately, with funds transferred to the landlord's account within 2-3 business days.",
        },
        {
          question: "Is it safe to pay rent online?",
          answer: "Yes, RentFlow uses bank-level encryption and security measures. We're PCI DSS compliant and never store your full card details. All payments are processed through Stripe, a trusted payment processor used by millions of businesses.",
        },
        {
          question: "Can I set up automatic rent payments?",
          answer: "Yes! Once you've made your first payment, you can save your payment method and set up recurring payments. You'll receive reminders before each payment and can cancel or modify your automatic payments anytime.",
        },
      ]}
    />
);

export const RentPaymentApp = () => (
    <SEOLandingPage
      title="Rent Payment App — RentFlow | Mobile-Friendly Rent Collection Platform"
      description="The best rent payment app for landlords and tenants. Pay and collect rent on any device. Mobile-optimized, secure, and easy to use. Start collecting rent online today."
      canonicalUrl="https://www.payrentflow.com/rent-payment-app"
      h1="The Best Rent Payment App for Landlords & Tenants"
      introParagraphs={[
        "RentFlow is a modern, mobile-friendly rent payment app that works seamlessly on your phone, tablet, or computer. Whether you're a landlord collecting rent or a tenant making payments, our platform is designed for convenience and ease of use.",
        "No app download required—RentFlow works in any web browser, so you can pay or collect rent from anywhere, at any time. Our responsive design ensures a smooth experience on any device.",
      ]}
      featureBullets={[
        "Works on any device—no app download needed",
        "Mobile-optimized interface for on-the-go payments",
        "Push notifications for payment reminders",
        "Quick payment with saved payment methods",
        "View payment history and statements anytime",
        "Secure mobile payments with biometric authentication support",
      ]}
      faqs={[
        {
          question: "Do I need to download an app?",
          answer: "No! RentFlow works in any web browser on your phone, tablet, or computer. Simply visit our website and log in—no app download required.",
        },
        {
          question: "Can I pay rent from my phone?",
          answer: "Absolutely! RentFlow is fully optimized for mobile devices. You can pay rent, view statements, and manage your account from any smartphone or tablet.",
        },
        {
          question: "Is the mobile app secure?",
          answer: "Yes, RentFlow uses the same bank-level security on mobile as on desktop. All payments are encrypted and processed securely through Stripe.",
        },
        {
          question: "Can landlords collect rent through the app?",
          answer: "Yes! Landlords can manage properties, view payments, and track rent collection all from their mobile device. You'll receive notifications when tenants make payments.",
        },
      ]}
    />
);

export const PayRentWithCreditCard = () => (
    <SEOLandingPage
      title="Pay Rent with Credit Card — RentFlow | Credit Card Rent Payments"
      description="Pay rent with a credit card using RentFlow. Secure, instant processing with automatic receipts. Earn credit card rewards on rent payments. Get started free."
      canonicalUrl="https://www.payrentflow.com/pay-rent-with-credit-card"
      h1="Pay Rent with Credit Card — Instant & Secure"
      introParagraphs={[
        "Need to pay rent with a credit card? RentFlow makes it easy. Simply enter your card details and your payment is processed instantly. Many tenants use credit cards to earn rewards points or miles on their rent payments.",
        "All credit card payments are processed securely through Stripe, with instant payment confirmations and automatic receipts sent to your email.",
      ]}
      featureBullets={[
        "Pay rent instantly with any major credit card",
        "Earn credit card rewards, points, or miles on rent",
        "Instant payment processing and confirmation",
        "Automatic email receipts for all payments",
        "Secure PCI-compliant payment processing",
        "Save card for faster future payments",
      ]}
      faqs={[
        {
          question: "Can I pay rent with a credit card?",
          answer: "Yes! RentFlow accepts all major credit cards including Visa, Mastercard, American Express, and Discover. Payments are processed instantly.",
        },
        {
          question: "What's the fee for credit card payments?",
          answer: "Credit card payments have a processing fee of 3.75% of the payment amount. This fee is clearly displayed before you complete your payment.",
        },
        {
          question: "Can I earn credit card rewards on rent?",
          answer: "Yes! Since you're paying with a credit card, you'll earn whatever rewards your card offers—points, miles, cash back, etc. This is a great way to maximize your credit card benefits.",
        },
        {
          question: "Is it safe to pay rent with a credit card?",
          answer: "Absolutely. RentFlow uses Stripe for payment processing, which is PCI DSS Level 1 compliant. We never store your full card number, and all transactions are encrypted.",
        },
      ]}
    />
);

export const PayRentWithDebitCard = () => (
    <SEOLandingPage
      title="Pay Rent with Debit Card — RentFlow | Debit Card Rent Payments"
      description="Pay rent with a debit card using RentFlow. Fast, secure processing with lower fees than credit cards. Instant payment confirmations. Start paying rent online today."
      canonicalUrl="https://www.payrentflow.com/pay-rent-with-debit-card"
      h1="Pay Rent with Debit Card — Fast & Convenient"
      introParagraphs={[
        "Paying rent with a debit card is quick and easy with RentFlow. Debit card payments are processed instantly, and you'll receive immediate confirmation of your payment.",
        "Debit card payments typically have lower processing fees than credit cards, making them a cost-effective option for rent payments.",
      ]}
      featureBullets={[
        "Pay rent instantly with any debit card",
        "Lower fees than credit card payments",
        "Instant payment processing and confirmation",
        "Automatic email receipts",
        "Secure payment processing",
        "Works with all major debit card networks",
      ]}
      faqs={[
        {
          question: "Can I pay rent with a debit card?",
          answer: "Yes! RentFlow accepts all major debit cards. Payments are processed instantly, just like credit card payments.",
        },
        {
          question: "What's the fee for debit card payments?",
          answer: "Debit card payments have a processing fee of 3.75% of the payment amount, the same as credit cards. This fee is clearly displayed before payment.",
        },
        {
          question: "How quickly is my payment processed?",
          answer: "Debit card payments are processed instantly. You'll receive immediate confirmation, and your landlord will see the payment in their account within 2-3 business days.",
        },
      ]}
    />
);

export const PayRentWithACH = () => (
    <SEOLandingPage
      title="Pay Rent with ACH / Bank Transfer — RentFlow | Low-Cost Rent Payments"
      description="Pay rent with ACH bank transfer using RentFlow. Lowest fees, secure processing, automatic reminders. Direct bank-to-bank transfers. Get started free."
      canonicalUrl="https://www.payrentflow.com/pay-rent-with-ach"
      h1="Pay Rent with ACH Bank Transfer — Lowest Fees"
      introParagraphs={[
        "Paying rent with ACH (bank transfer) is the most cost-effective option. With just a $5 flat fee per payment, ACH transfers are perfect for tenants who want to minimize payment costs.",
        "Simply connect your bank account and payments are processed directly from your bank to your landlord's account. ACH transfers typically take 2-3 business days to process.",
      ]}
      featureBullets={[
        "Lowest fees—just $5 flat fee per payment",
        "Direct bank-to-bank transfers",
        "Secure connection with your bank",
        "Automatic payment reminders",
        "Save bank account for recurring payments",
        "No credit check required",
      ]}
      faqs={[
        {
          question: "What is ACH payment?",
          answer: "ACH (Automated Clearing House) is a bank-to-bank transfer system. It's the same method used for direct deposit and automatic bill pay. It's secure, reliable, and cost-effective.",
        },
        {
          question: "How much does ACH payment cost?",
          answer: "ACH payments have a flat fee of $5 per payment, regardless of the rent amount. This is much lower than credit or debit card fees.",
        },
        {
          question: "How long do ACH payments take?",
          answer: "ACH bank transfers typically take 2-3 business days to process. Your payment will be deducted from your account and transferred to your landlord's account.",
        },
        {
          question: "Is it safe to connect my bank account?",
          answer: "Yes, RentFlow uses Plaid (a trusted financial services company) to securely connect your bank account. We use bank-level encryption and never store your banking credentials.",
        },
        {
          question: "Can I set up automatic ACH payments?",
          answer: "Yes! Once you've connected your bank account, you can set up recurring ACH payments. You'll receive reminders before each payment and can cancel anytime.",
        },
      ]}
    />
);

// Landlord/Manager Intent Pages (Higher Buying Intent)
export const PropertyManagementSoftware = () => (
    <SEOLandingPage
      title="Property Management Software — RentFlow | All-in-One Property Management Platform"
      description="The best property management software for landlords. Manage properties, tenants, rent collection, and maintenance all in one platform. Free to get started."
      canonicalUrl="https://www.payrentflow.com/property-management-software"
      h1="Property Management Software That Actually Works"
      introParagraphs={[
        "RentFlow is comprehensive property management software designed for modern landlords. Manage all your properties, units, and tenants from one centralized dashboard. No more spreadsheets, no more juggling multiple tools.",
        "From tenant screening to rent collection, maintenance requests to financial reporting—RentFlow has everything you need to run your rental business efficiently.",
      ]}
      featureBullets={[
        "Centralized dashboard for all properties and units",
        "Automated rent collection with online payments",
        "Tenant portal for self-service requests",
        "Automated late fee calculations",
        "Financial reporting and statements",
        "Maintenance request tracking and management",
      ]}
      faqs={[
        {
          question: "What is property management software?",
          answer: "Property management software helps landlords manage their rental properties, tenants, and finances. RentFlow provides tools for rent collection, tenant communication, maintenance tracking, and financial reporting all in one platform.",
        },
        {
          question: "How much does property management software cost?",
          answer: "RentFlow is free to get started. We only charge small processing fees when tenants make payments (3.75% for cards, $5 for ACH). There are no monthly subscription fees or setup costs.",
        },
        {
          question: "Can I manage multiple properties?",
          answer: "Yes! RentFlow is designed to handle multiple properties and units. You can organize properties, assign tenants, and track everything from one dashboard.",
        },
        {
          question: "Does it work for small landlords?",
          answer: "Absolutely! RentFlow works great for landlords with just one property or hundreds. Our platform scales with your business.",
        },
        {
          question: "What features are included?",
          answer: "RentFlow includes online rent collection, tenant management, automated late fees, financial reporting, statement generation, and a tenant portal. All core features are included at no additional cost.",
        },
      ]}
    />
);

export const RentCollectionSoftware = () => (
    <SEOLandingPage
      title="Rent Collection Software — RentFlow | Automated Online Rent Collection"
      description="The best rent collection software for landlords. Automate rent collection, late fees, and payment reminders. Accept online payments from tenants. Free to start."
      canonicalUrl="https://www.payrentflow.com/rent-collection-software"
      h1="Rent Collection Software That Saves You Time"
      introParagraphs={[
        "Stop chasing rent payments. RentFlow's rent collection software automates the entire process. Tenants pay online, you receive payments directly to your bank account, and late fees are calculated automatically.",
        "Set up your properties once, and RentFlow handles the rest—payment reminders, late fee calculations, payment confirmations, and financial reporting.",
      ]}
      featureBullets={[
        "Automated rent collection from tenants",
        "Automatic payment reminders via email",
        "Automated late fee calculations",
        "Direct deposit to your bank account",
        "Real-time payment tracking and notifications",
        "Detailed payment history and reports",
      ]}
      faqs={[
        {
          question: "How does rent collection software work?",
          answer: "RentFlow connects your bank account via Stripe Connect. When tenants pay rent online, funds are automatically transferred to your account. You'll receive notifications for every payment and can track everything in your dashboard.",
        },
        {
          question: "How do I receive rent payments?",
          answer: "All rent payments are sent directly to your connected bank account via Stripe. You'll receive payments within 2-3 business days after a tenant makes a payment.",
        },
        {
          question: "Are late fees calculated automatically?",
          answer: "Yes! RentFlow automatically calculates late fees based on your unit settings. You can set flat fees, percentage-based fees, or daily late fees. Everything is calculated and applied automatically.",
        },
        {
          question: "Can tenants pay with different methods?",
          answer: "Yes, tenants can pay with credit cards, debit cards, or ACH bank transfers. You'll receive all payments the same way, regardless of the payment method.",
        },
        {
          question: "Is there a monthly fee?",
          answer: "No monthly fees! RentFlow is free to use. We only charge small processing fees when tenants make payments (which are paid by the tenant, not you).",
        },
      ]}
    />
);

export const TenantManagementSoftware = () => (
    <SEOLandingPage
      title="Tenant Management Software — RentFlow | Manage Tenants & Properties"
      description="Best tenant management software for landlords. Track tenants, assignments, payments, and communications. Free tenant portal included. Get started free."
      canonicalUrl="https://www.payrentflow.com/tenant-management-software"
      h1="Tenant Management Software Made Simple"
      introParagraphs={[
        "Manage all your tenants from one place with RentFlow's tenant management software. Track tenant assignments, payment history, contact information, and more.",
        "Each tenant gets access to their own portal where they can view statements, make payments, submit maintenance requests, and communicate with you.",
      ]}
      featureBullets={[
        "Centralized tenant database and profiles",
        "Track tenant assignments to units",
        "View payment history per tenant",
        "Tenant portal for self-service",
        "Automated tenant communications",
        "Tenant payment tracking and reporting",
      ]}
      faqs={[
        {
          question: "What is tenant management software?",
          answer: "Tenant management software helps landlords organize and track information about their tenants, including contact details, unit assignments, payment history, and communications. RentFlow provides all of this in one easy-to-use platform.",
        },
        {
          question: "Can tenants access their own portal?",
          answer: "Yes! Each tenant gets their own secure portal where they can view statements, make payments, see payment history, and submit maintenance requests.",
        },
        {
          question: "How do I add tenants to the system?",
          answer: "You can add tenants manually when creating or editing a unit, or tenants can sign up themselves. Once added, you can assign them to units and they'll automatically receive statements and payment reminders.",
        },
        {
          question: "Can I see all payments from a specific tenant?",
          answer: "Yes, you can view a complete payment history for each tenant, including payment dates, amounts, and methods used.",
        },
      ]}
    />
);

export const LateFeeAutomation = () => (
    <SEOLandingPage
      title="Late Fee Automation — RentFlow | Automatic Late Fee Calculations"
      description="Automate late fee calculations with RentFlow. Set flat fees, percentage-based fees, or daily late fees. Automatic calculations and notifications. Free to start."
      canonicalUrl="https://www.payrentflow.com/late-fee-automation"
      h1="Automate Late Fee Calculations — Set It and Forget It"
      introParagraphs={[
        "Never manually calculate late fees again. RentFlow automatically calculates and applies late fees based on your settings. Choose from flat fees, percentage-based fees, or daily late fees—or combine them all.",
        "Late fees are calculated automatically when rent becomes overdue, and tenants are notified immediately. You can customize late fee rules for each unit, including grace periods and split payment options.",
      ]}
      featureBullets={[
        "Automatic late fee calculations",
        "Flexible fee types: flat, percentage, or daily",
        "Customizable grace periods",
        "Automatic late fee notifications to tenants",
        "Split payment options with reduced fees",
        "Late fee tracking and reporting",
      ]}
      faqs={[
        {
          question: "How does late fee automation work?",
          answer: "You set your late fee rules for each unit (flat fee, percentage, or daily fee). When rent becomes overdue, RentFlow automatically calculates the late fee based on how many days late the payment is and applies it to the tenant's statement.",
        },
        {
          question: "What types of late fees can I set?",
          answer: "You can set flat late fees (e.g., $50), percentage-based fees (e.g., 5% of rent), or daily late fees (e.g., $5 per day). You can also combine flat and daily fees.",
        },
        {
          question: "Can I set a grace period?",
          answer: "Yes! You can configure when late fees start applying. For example, you might want to give tenants 5 days before applying the first late fee.",
        },
        {
          question: "Are tenants notified about late fees?",
          answer: "Yes, tenants automatically receive email notifications when late fees are applied to their account. They can see the breakdown of fees in their tenant portal.",
        },
        {
          question: "Can I customize late fees per unit?",
          answer: "Absolutely! Each unit can have its own late fee settings. This is useful if you have different properties with different policies.",
        },
      ]}
    />
);

// Trust + Conversion Pages
export const Pricing = () => (
    <SEOLandingPage
      title="Pricing — RentFlow | Free Property Management Software"
      description="RentFlow pricing: Free to use. No monthly fees. Only pay small processing fees when tenants make payments. Transparent pricing with no hidden costs. Get started free."
      canonicalUrl="https://www.payrentflow.com/pricing"
      h1="Simple, Transparent Pricing — Free to Start"
      introParagraphs={[
        "RentFlow is free to use. There are no monthly subscription fees, no setup costs, and no hidden charges. You only pay small processing fees when tenants make payments—and those fees are paid by the tenant, not you.",
        "This means you can start managing properties and collecting rent online without any upfront investment. Scale your business without worrying about increasing software costs.",
      ]}
      featureBullets={[
        "Free to use—no monthly subscription fees",
        "No setup costs or hidden charges",
        "Tenants pay processing fees (not you)",
        "Credit card payments: 3.75% fee (paid by tenant)",
        "ACH bank transfers: $5 flat fee (paid by tenant)",
        "All core features included at no cost",
      ]}
      faqs={[
        {
          question: "How much does RentFlow cost?",
          answer: "RentFlow is completely free to use. There are no monthly fees, no setup costs, and no subscription charges. You only pay when tenants make payments, and those fees are paid by the tenant, not you.",
        },
        {
          question: "What are the payment processing fees?",
          answer: "Credit and debit card payments have a 3.75% processing fee, while ACH bank transfers have a flat $5 fee. These fees are clearly displayed to tenants before they pay and are paid by the tenant, not the landlord.",
        },
        {
          question: "Are there any hidden fees?",
          answer: "No hidden fees whatsoever. What you see is what you get. The only fees are the payment processing fees, which are paid by tenants when they make payments.",
        },
        {
          question: "Do I need to pay for features?",
          answer: "No! All core features are included free: property management, tenant management, online rent collection, automated late fees, financial reporting, and tenant portals. Everything is included.",
        },
        {
          question: "Can I cancel anytime?",
          answer: "Yes, you can stop using RentFlow at any time. Since there are no monthly fees, there's nothing to cancel. You're free to use the platform as long as you need it.",
        },
      ]}
    />
);

export const Features = () => (
    <SEOLandingPage
      title="Features — RentFlow | Complete Property Management Features"
      description="Complete property management features: online rent collection, tenant management, automated late fees, financial reporting, tenant portals, and more. All included free."
      canonicalUrl="https://www.payrentflow.com/features"
      h1="Everything You Need to Manage Rental Properties"
      introParagraphs={[
        "RentFlow provides all the tools you need to manage your rental properties efficiently. From rent collection to tenant communication, financial reporting to maintenance tracking—it's all here.",
        "Our platform is designed to save you time and reduce administrative work, so you can focus on growing your rental business.",
      ]}
      featureBullets={[
        "Online rent collection with multiple payment methods",
        "Automated late fee calculations and notifications",
        "Tenant portal for self-service",
        "Financial reporting and statements",
        "Property and unit management",
        "Maintenance request tracking",
        "Automated payment reminders",
        "Bank-level security and compliance",
      ]}
      faqs={[
        {
          question: "What features does RentFlow include?",
          answer: "RentFlow includes online rent collection, tenant management, automated late fees, financial reporting, statement generation, tenant portals, payment tracking, and more. All core features are included free.",
        },
        {
          question: "Can tenants pay online?",
          answer: "Yes! Tenants can pay rent online using credit cards, debit cards, or ACH bank transfers. All payments are processed securely and automatically tracked.",
        },
        {
          question: "Do you offer a tenant portal?",
          answer: "Yes, each tenant gets their own secure portal where they can view statements, make payments, see payment history, and submit maintenance requests.",
        },
        {
          question: "Can I generate financial reports?",
          answer: "Yes! RentFlow provides detailed financial reports including payment history, yearly summaries by property, and tenant payment tracking.",
        },
        {
          question: "Is there mobile access?",
          answer: "Yes, RentFlow works on any device—desktop, tablet, or mobile phone. No app download required, just log in from any web browser.",
        },
      ]}
    />
);

export const HowItWorks = () => (
    <SEOLandingPage
      title="How It Works — RentFlow | Simple Property Management Setup"
      description="See how RentFlow works. Get started in minutes: create account, add properties, start collecting rent. Simple setup, powerful features. Free to start."
      canonicalUrl="https://www.payrentflow.com/how-it-works"
      h1="How RentFlow Works — Get Started in Minutes"
      introParagraphs={[
        "Getting started with RentFlow is quick and easy. In just a few minutes, you can set up your account, add your properties, and start collecting rent online.",
        "Our platform is designed to be intuitive and user-friendly, so you can start managing properties right away without extensive training or setup.",
      ]}
      featureBullets={[
        "Sign up in seconds with just your email",
        "Add properties and units with our easy forms",
        "Connect your bank account for payments",
        "Invite tenants or let them sign up themselves",
        "Start collecting rent immediately",
        "Automated reminders and late fees from day one",
      ]}
      faqs={[
        {
          question: "How long does it take to set up?",
          answer: "You can get started in just a few minutes. Create your account, add your first property, and connect your bank account. Once that's done, you can start collecting rent immediately.",
        },
        {
          question: "Do I need technical knowledge?",
          answer: "Not at all! RentFlow is designed to be user-friendly. If you can use email and a web browser, you can use RentFlow. Our interface is intuitive and straightforward.",
        },
        {
          question: "How do I add my properties?",
          answer: "Simply go to the Properties section and click 'Add Property'. Enter your property details, then add units. You can add multiple properties and units as needed.",
        },
        {
          question: "How do tenants get access?",
          answer: "You can invite tenants by email, or they can sign up themselves. Once they're added and assigned to a unit, they'll automatically receive statements and can start making payments.",
        },
        {
          question: "What if I need help?",
          answer: "We offer 24/7 support via email. Our help center also has guides and FAQs to answer common questions. We're here to help you succeed!",
        },
      ]}
    />
);

export const Security = () => (
    <SEOLandingPage
      title="Security — RentFlow | Bank-Level Security for Rent Payments"
      description="RentFlow uses bank-level security and encryption. PCI DSS compliant, secure payment processing, data encryption, and privacy protection. Your data is safe with us."
      canonicalUrl="https://www.payrentflow.com/security"
      h1="Bank-Level Security for Your Rent Payments"
      introParagraphs={[
        "Security is our top priority. RentFlow uses the same security measures as major banks to protect your financial data and personal information. We're PCI DSS Level 1 compliant and use industry-standard encryption.",
        "All payments are processed through Stripe, a trusted payment processor used by millions of businesses worldwide. Your banking credentials are never stored on our servers.",
      ]}
      featureBullets={[
        "PCI DSS Level 1 compliant payment processing",
        "Bank-level encryption for all data",
        "Secure payment processing through Stripe",
        "Never store full card numbers or banking credentials",
        "Regular security audits and monitoring",
        "GDPR and privacy law compliant",
      ]}
      faqs={[
        {
          question: "Is RentFlow secure?",
          answer: "Yes! RentFlow uses bank-level security measures including encryption, secure payment processing, and compliance with industry standards like PCI DSS. We take security seriously.",
        },
        {
          question: "How are payments processed?",
          answer: "All payments are processed through Stripe, one of the world's most trusted payment processors. Stripe is PCI DSS Level 1 compliant and used by millions of businesses.",
        },
        {
          question: "Is my banking information stored?",
          answer: "No, we never store your full banking credentials or card numbers. When you connect your bank account, we use Plaid (a trusted financial services company) to securely verify your account without storing sensitive information.",
        },
        {
          question: "What encryption do you use?",
          answer: "RentFlow uses industry-standard encryption (TLS/SSL) for all data transmission. All data is encrypted both in transit and at rest.",
        },
        {
          question: "Is my tenant data protected?",
          answer: "Absolutely. We comply with GDPR and other privacy regulations. Tenant data is encrypted and only accessible to authorized users. We never sell or share your data.",
        },
      ]}
    />
);

export const Contact = () => (
    <SEOLandingPage
      title="Contact Us — RentFlow | Get Help & Support"
      description="Contact RentFlow for support, questions, or partnership inquiries. We're here to help 24/7. Get in touch via email or visit our help center."
      canonicalUrl="https://www.payrentflow.com/contact"
      h1="Get in Touch — We're Here to Help"
      introParagraphs={[
        "Have questions about RentFlow? Need help getting started? Want to discuss a partnership? We're here to help. Our support team is available 24/7 to assist you.",
        "Whether you're a landlord looking to streamline rent collection or a tenant with payment questions, we're ready to help you succeed with RentFlow.",
      ]}
      featureBullets={[
        "24/7 email support",
        "Comprehensive help center",
        "Quick response times",
        "Dedicated support team",
        "Partnership inquiries welcome",
        "Feature requests and feedback",
      ]}
      faqs={[
        {
          question: "How can I contact support?",
          answer: "You can reach our support team via email at support@payrentflow.com. We typically respond within 24 hours, often much faster. We're here to help 24/7.",
        },
        {
          question: "Do you offer phone support?",
          answer: "Currently, we offer email support. Our help center has comprehensive guides and FAQs that answer most questions. If you need additional help, our email support team is very responsive.",
        },
        {
          question: "How quickly will I get a response?",
          answer: "We aim to respond to all support emails within 24 hours, and often respond much faster. For urgent issues, we prioritize those requests.",
        },
        {
          question: "Can I request new features?",
          answer: "Absolutely! We love hearing from our users. Send us your feature requests via email, and we'll consider them for future updates.",
        },
        {
          question: "Do you offer partnerships?",
          answer: "Yes! If you're interested in partnering with RentFlow, whether you're a property management company, real estate platform, or other business, we'd love to hear from you.",
        },
      ]}
    />
);

export const About = () => (
    <SEOLandingPage
      title="About Us — RentFlow | Modern Property Management Platform"
      description="Learn about RentFlow. We're building the future of property management with simple, powerful tools for landlords and tenants. Trusted by 2,000+ property managers."
      canonicalUrl="https://www.payrentflow.com/about"
      h1="About RentFlow — Modern Property Management"
      introParagraphs={[
        "RentFlow was founded with a simple mission: make property management easier for everyone. We believe that managing rental properties shouldn't be complicated or expensive.",
        "Our platform combines powerful features with an intuitive interface, making it easy for landlords to collect rent, manage tenants, and grow their rental business. For tenants, we provide a simple, secure way to pay rent online.",
      ]}
      featureBullets={[
        "Trusted by 2,000+ property managers",
        "Processing $50M+ in rent payments",
        "99.9% uptime guarantee",
        "24/7 customer support",
        "Continuously improving based on user feedback",
        "Committed to security and privacy",
      ]}
      faqs={[
        {
          question: "Who is RentFlow for?",
          answer: "RentFlow is designed for landlords and property managers of all sizes—from individual landlords with one property to large property management companies. We also serve tenants who want an easy way to pay rent online.",
        },
        {
          question: "How long has RentFlow been around?",
          answer: "RentFlow is a modern platform built with the latest technology. We're continuously improving based on user feedback and industry best practices.",
        },
        {
          question: "What makes RentFlow different?",
          answer: "RentFlow focuses on simplicity and value. We provide powerful features without the complexity or high costs of traditional property management software. Plus, we're free to use with transparent, tenant-paid processing fees.",
        },
        {
          question: "Where is RentFlow based?",
          answer: "RentFlow is a cloud-based platform, accessible from anywhere in the world. Our infrastructure is built for reliability and security, ensuring your data is always safe and accessible.",
        },
        {
          question: "How can I stay updated on new features?",
          answer: "We regularly update RentFlow with new features and improvements. You'll receive email notifications about major updates, and you can always check our help center for the latest information.",
        },
      ]}
    />
);
