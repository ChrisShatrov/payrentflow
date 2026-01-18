import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

export default function Privacy() {
  return (
    <>
      <Helmet>
        <title>Privacy Policy | RentFlow</title>
        <meta
          name="description"
          content="RentFlow's Privacy Policy. Learn how we collect, use, and protect your personal information and data."
        />
        <link rel="canonical" href="https://www.payrentflow.com/privacy" />
      </Helmet>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
          <div className="container flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <img src="/logo.png" alt="RentFlow" className="w-12 h-12" />
              <h1 className="text-3xl font-extrabold tracking-tight">
                <span className="text-primary">Rent</span>
                <span className="text-foreground">Flow</span>
              </h1>
            </Link>
            <nav className="hidden md:flex items-center gap-8">
              <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
                Home
              </Link>
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main className="pt-24 pb-16 px-4">
          <div className="container max-w-4xl mx-auto">
            <div className="bg-card border border-border rounded-xl p-8 md:p-12">
              <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
              <p className="text-muted-foreground mb-8">
                Last updated: January 20, 2026
              </p>

              <div className="prose prose-slate max-w-none dark:prose-invert">
                <p className="text-muted-foreground mb-8">
                  At RentFlow, we are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our property management and rent payment platform.
                </p>

                <h2 className="text-2xl font-semibold mt-8 mb-4">1. Information We Collect</h2>
                
                <h3 className="text-xl font-semibold mt-6 mb-3">1.1 Personal Information</h3>
                <p>We collect information that you provide directly to us, including:</p>
                <ul className="list-disc pl-6 space-y-2 my-4">
                  <li>Name, email address, phone number, and mailing address</li>
                  <li>Account credentials (username, password)</li>
                  <li>Property information (addresses, unit numbers, rental amounts)</li>
                  <li>Tenant and landlord relationship information</li>
                  <li>Payment information (processed securely through Stripe)</li>
                  <li>Lease agreement documents and related information</li>
                </ul>

                <h3 className="text-xl font-semibold mt-6 mb-3">1.2 Payment Information</h3>
                <p>
                  Payment card information is collected and processed securely through Stripe, our payment processor. 
                  We do not store full credit card numbers on our servers. Stripe handles all payment data in compliance 
                  with PCI DSS standards.
                </p>

                <h3 className="text-xl font-semibold mt-6 mb-3">1.3 Automatically Collected Information</h3>
                <p>When you use our service, we automatically collect:</p>
                <ul className="list-disc pl-6 space-y-2 my-4">
                  <li>Device information (IP address, browser type, operating system)</li>
                  <li>Usage data (pages visited, features used, time spent)</li>
                  <li>Log files and error reports</li>
                  <li>Cookies and similar tracking technologies</li>
                </ul>

                <h2 className="text-2xl font-semibold mt-8 mb-4">2. How We Use Your Information</h2>
                <p>We use the information we collect to:</p>
                <ul className="list-disc pl-6 space-y-2 my-4">
                  <li>Provide, maintain, and improve our services</li>
                  <li>Process rent payments and manage financial transactions</li>
                  <li>Send payment reminders, statements, and notifications</li>
                  <li>Facilitate lease agreement creation and electronic signatures through DocuSign</li>
                  <li>Communicate with you about your account and our services</li>
                  <li>Detect, prevent, and address technical issues and security threats</li>
                  <li>Comply with legal obligations and enforce our terms of service</li>
                  <li>Send marketing communications (with your consent, which you can opt out of)</li>
                </ul>

                <h2 className="text-2xl font-semibold mt-8 mb-4">3. Data Sharing and Disclosure</h2>
                <p>We do not sell your personal information. We may share your information in the following circumstances:</p>
                
                <h3 className="text-xl font-semibold mt-6 mb-3">3.1 Service Providers</h3>
                <p>We share information with trusted third-party service providers who assist us in operating our platform:</p>
                <ul className="list-disc pl-6 space-y-2 my-4">
                  <li><strong>Stripe:</strong> Payment processing and financial transactions</li>
                  <li><strong>DocuSign:</strong> Electronic signature services for lease agreements</li>
                  <li><strong>Resend:</strong> Email delivery and notifications</li>
                  <li><strong>Supabase:</strong> Cloud infrastructure and database hosting</li>
                </ul>
                <p>These service providers are contractually obligated to protect your information and use it only for the purposes we specify.</p>

                <h3 className="text-xl font-semibold mt-6 mb-3">3.2 Legal Requirements</h3>
                <p>We may disclose your information if required by law, court order, or government regulation, or to:</p>
                <ul className="list-disc pl-6 space-y-2 my-4">
                  <li>Comply with legal processes or respond to government requests</li>
                  <li>Protect our rights, property, or safety, or that of our users</li>
                  <li>Prevent fraud or other illegal activities</li>
                </ul>

                <h3 className="text-xl font-semibold mt-6 mb-3">3.3 Business Transfers</h3>
                <p>
                  In the event of a merger, acquisition, or sale of assets, your information may be transferred to the 
                  acquiring entity, subject to the same privacy protections.
                </p>

                <h2 className="text-2xl font-semibold mt-8 mb-4">4. Data Security</h2>
                <p>
                  We implement industry-standard security measures to protect your information, including:
                </p>
                <ul className="list-disc pl-6 space-y-2 my-4">
                  <li>Encryption of data in transit (SSL/TLS) and at rest</li>
                  <li>Secure authentication and access controls</li>
                  <li>Regular security audits and vulnerability assessments</li>
                  <li>PCI DSS compliance for payment processing</li>
                  <li>Limited access to personal information on a need-to-know basis</li>
                </ul>
                <p>
                  However, no method of transmission over the internet or electronic storage is 100% secure. 
                  While we strive to protect your information, we cannot guarantee absolute security.
                </p>

                <h2 className="text-2xl font-semibold mt-8 mb-4">5. Your Rights and Choices</h2>
                
                <h3 className="text-xl font-semibold mt-6 mb-3">5.1 Access and Correction</h3>
                <p>
                  You can access and update your personal information at any time through your account settings. 
                  You may also request a copy of your data by contacting us.
                </p>

                <h3 className="text-xl font-semibold mt-6 mb-3">5.2 Data Deletion</h3>
                <p>
                  You may request deletion of your account and personal information. We will honor such requests 
                  subject to our legal obligations to retain certain records (e.g., financial transaction records).
                </p>

                <h3 className="text-xl font-semibold mt-6 mb-3">5.3 GDPR Rights (EU Users)</h3>
                <p>If you are located in the European Union, you have the right to:</p>
                <ul className="list-disc pl-6 space-y-2 my-4">
                  <li>Access your personal data</li>
                  <li>Rectify inaccurate data</li>
                  <li>Request erasure of your data</li>
                  <li>Object to processing of your data</li>
                  <li>Data portability</li>
                  <li>Withdraw consent at any time</li>
                </ul>

                <h3 className="text-xl font-semibold mt-6 mb-3">5.4 CCPA Rights (California Users)</h3>
                <p>If you are a California resident, you have the right to:</p>
                <ul className="list-disc pl-6 space-y-2 my-4">
                  <li>Know what personal information is collected</li>
                  <li>Know whether your personal information is sold or disclosed</li>
                  <li>Opt out of the sale of personal information (we do not sell personal information)</li>
                  <li>Access and delete your personal information</li>
                  <li>Non-discrimination for exercising your privacy rights</li>
                </ul>

                <h2 className="text-2xl font-semibold mt-8 mb-4">6. Cookies and Tracking Technologies</h2>
                <p>
                  We use cookies and similar technologies to enhance your experience, analyze usage patterns, and 
                  improve our services. You can control cookies through your browser settings, though disabling 
                  cookies may limit some functionality.
                </p>
                <p className="mt-4">
                  We use cookies for:
                </p>
                <ul className="list-disc pl-6 space-y-2 my-4">
                  <li>Authentication and session management</li>
                  <li>Remembering your preferences</li>
                  <li>Analyzing website traffic and usage</li>
                  <li>Security and fraud prevention</li>
                </ul>

                <h2 className="text-2xl font-semibold mt-8 mb-4">7. Third-Party Services</h2>
                <p>Our platform integrates with the following third-party services:</p>
                <ul className="list-disc pl-6 space-y-2 my-4">
                  <li><strong>Stripe:</strong> Payment processing. See Stripe's privacy policy at <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">stripe.com/privacy</a></li>
                  <li><strong>DocuSign:</strong> Electronic signatures. See DocuSign's privacy policy at <a href="https://www.docusign.com/company/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">docusign.com/privacy-policy</a></li>
                  <li><strong>Resend:</strong> Email delivery. See Resend's privacy policy at <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">resend.com/legal/privacy-policy</a></li>
                </ul>
                <p>
                  These services have their own privacy policies, and we encourage you to review them. 
                  We are not responsible for the privacy practices of these third-party services.
                </p>

                <h2 className="text-2xl font-semibold mt-8 mb-4">8. Children's Privacy</h2>
                <p>
                  Our service is not intended for individuals under the age of 18. We do not knowingly collect 
                  personal information from children. If we become aware that we have collected information from 
                  a child, we will take steps to delete such information promptly.
                </p>

                <h2 className="text-2xl font-semibold mt-8 mb-4">9. Data Retention</h2>
                <p>
                  We retain your personal information for as long as necessary to provide our services, comply with 
                  legal obligations, resolve disputes, and enforce our agreements. Financial and transaction records 
                  may be retained for longer periods as required by law.
                </p>

                <h2 className="text-2xl font-semibold mt-8 mb-4">10. International Data Transfers</h2>
                <p>
                  Your information may be transferred to and processed in countries other than your country of residence. 
                  We ensure that appropriate safeguards are in place to protect your information in accordance with this 
                  Privacy Policy and applicable data protection laws.
                </p>

                <h2 className="text-2xl font-semibold mt-8 mb-4">11. Changes to This Privacy Policy</h2>
                <p>
                  We may update this Privacy Policy from time to time. We will notify you of any material changes by 
                  posting the new Privacy Policy on this page and updating the "Last updated" date. We encourage you 
                  to review this Privacy Policy periodically.
                </p>

                <h2 className="text-2xl font-semibold mt-8 mb-4">12. Contact Us</h2>
                <p>If you have questions or concerns about this Privacy Policy or our data practices, please contact us:</p>
                <ul className="list-none space-y-2 my-4">
                  <li><strong>Email:</strong> privacy@payrentflow.com</li>
                  <li><strong>Website:</strong> <Link to="/contact" className="text-primary hover:underline">Contact Us</Link></li>
                </ul>

                <div className="mt-8 p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>Note:</strong> This Privacy Policy is provided for informational purposes and does not 
                    constitute legal advice. If you have specific legal questions, please consult with a qualified attorney.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="py-12 px-4 border-t border-border">
          <div className="container">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="RentFlow" className="w-10 h-10" />
                <span className="font-semibold text-foreground">RentFlow</span>
              </div>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
                <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
                <Link to="/contact" className="hover:text-foreground transition-colors">Support</Link>
              </div>
              <p className="text-sm text-muted-foreground">
                © 2026 RentFlow. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
