import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface BlogPostPreview {
  slug: string;
  title: string;
  description: string;
  publishDate: string;
  readTime: string;
  category: string;
}

const blogPosts: BlogPostPreview[] = [
  {
    slug: "how-to-collect-rent-online-ach-vs-card",
    title: "How to Collect Rent Online: ACH vs Credit Card Payments",
    description: "Compare ACH bank transfers and credit card payments for rent collection. Learn the pros, cons, fees, and which method works best for your property.",
    publishDate: "January 15, 2026",
    readTime: "8 min",
    category: "Landlord Guide",
  },
  {
    slug: "are-online-rent-payments-safe",
    title: "Are Online Rent Payments Safe? What Landlords and Tenants Should Know",
    description: "Learn about security measures, encryption, PCI compliance, and best practices for safe online rent payments. Protect your financial data.",
    publishDate: "January 14, 2026",
    readTime: "6 min",
    category: "Security",
  },
  {
    slug: "how-to-automate-late-fees-legally",
    title: "How to Automate Late Fees Legally: A State-by-State Guide",
    description: "Understand late fee laws by state, grace periods, maximum fees, and how to implement automated late fee calculations legally.",
    publishDate: "January 13, 2026",
    readTime: "10 min",
    category: "Legal",
  },
  {
    slug: "best-rent-payment-apps-for-landlords",
    title: "Best Rent Payment Apps for Landlords: 2026 Comparison Guide",
    description: "Compare top rent collection platforms, features, pricing, and find the best solution for your property management needs.",
    publishDate: "January 12, 2026",
    readTime: "12 min",
    category: "Comparison",
  },
  {
    slug: "what-is-a-rent-payment-portal",
    title: "What is a Rent Payment Portal? Complete Guide for Landlords",
    description: "Learn what rent payment portals are, how they work, key features, and why they're essential for modern property management.",
    publishDate: "January 11, 2026",
    readTime: "7 min",
    category: "Basics",
  },
  {
    slug: "tenant-screening-checklist",
    title: "Tenant Screening Checklist: Essential Steps for Landlords",
    description: "A comprehensive guide to tenant screening including credit checks, background checks, income verification, and red flags to watch for.",
    publishDate: "January 10, 2026",
    readTime: "9 min",
    category: "Landlord Guide",
  },
  {
    slug: "how-to-set-up-online-rent-payments",
    title: "How to Set Up Online Rent Payments: Step-by-Step Guide",
    description: "Follow this detailed guide to set up online rent collection, connect your bank account, and start accepting payments from tenants.",
    publishDate: "January 9, 2026",
    readTime: "6 min",
    category: "Setup",
  },
  {
    slug: "rent-payment-processing-fees-explained",
    title: "Rent Payment Processing Fees Explained: What Landlords Need to Know",
    description: "Understand credit card fees, ACH fees, who pays them, and how to minimize costs while maximizing convenience for tenants.",
    publishDate: "January 8, 2026",
    readTime: "5 min",
    category: "Finance",
  },
  {
    slug: "split-rent-payments-guide",
    title: "Split Rent Payments: How to Allow Tenants to Pay in Installments",
    description: "Learn about split payment options, fees, legal considerations, and how to implement installment payments for rent.",
    publishDate: "January 7, 2026",
    readTime: "7 min",
    category: "Landlord Guide",
  },
  {
    slug: "automated-rent-reminders-benefits",
    title: "Automated Rent Reminders: Benefits and Best Practices",
    description: "Discover how automated payment reminders reduce late payments, improve cash flow, and enhance tenant relationships.",
    publishDate: "January 6, 2026",
    readTime: "5 min",
    category: "Automation",
  },
  {
    slug: "property-management-software-features",
    title: "Essential Property Management Software Features for 2026",
    description: "Learn about must-have features in property management software including rent collection, tenant portals, and financial reporting.",
    publishDate: "January 5, 2026",
    readTime: "8 min",
    category: "Software",
  },
  {
    slug: "tenant-portal-benefits",
    title: "Why Every Landlord Needs a Tenant Portal in 2026",
    description: "Explore the benefits of tenant portals: reduced administrative work, faster payments, better communication, and improved tenant satisfaction.",
    publishDate: "January 4, 2026",
    readTime: "6 min",
    category: "Technology",
  },
  {
    slug: "rent-collection-best-practices",
    title: "Rent Collection Best Practices: Tips from Successful Landlords",
    description: "Proven strategies for consistent rent collection, reducing late payments, and maintaining positive landlord-tenant relationships.",
    publishDate: "January 3, 2026",
    readTime: "9 min",
    category: "Landlord Guide",
  },
  {
    slug: "mobile-rent-payments-guide",
    title: "Mobile Rent Payments: The Future of Property Management",
    description: "Learn how mobile payment options improve tenant experience, increase on-time payments, and streamline property management.",
    publishDate: "January 2, 2026",
    readTime: "7 min",
    category: "Technology",
  },
  {
    slug: "financial-reporting-for-landlords",
    title: "Financial Reporting for Landlords: Track Income and Expenses",
    description: "Understand the importance of financial reporting, what to track, and how property management software simplifies tax preparation.",
    publishDate: "January 1, 2026",
    readTime: "8 min",
    category: "Finance",
  },
];

export default function Resources() {
  return (
    <>
      <Helmet>
        <title>Resources & Blog — RentFlow | Property Management Guides</title>
        <meta
          name="description"
          content="Expert guides on rent collection, property management, tenant screening, and more. Learn best practices from industry professionals."
        />
        <link rel="canonical" href="https://www.payrentflow.com/resources" />
        
        {/* Open Graph */}
        <meta property="og:title" content="Resources & Blog — RentFlow" />
        <meta property="og:description" content="Expert guides on rent collection, property management, tenant screening, and more." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.payrentflow.com/resources" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Resources & Blog — RentFlow" />
        <meta name="twitter:description" content="Expert guides on rent collection, property management, tenant screening, and more." />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
          <div className="container flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">R</span>
              </div>
              <span className="text-xl font-bold text-foreground">RentFlow</span>
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <a href="/#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
              <a href="/#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">How It Works</a>
              <a href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
              <Link to="/resources" className="text-foreground font-medium">Resources</Link>
            </nav>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/auth">Sign In</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/signup">Get Started</Link>
              </Button>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="pt-24 pb-12 px-4">
          <div className="container max-w-6xl">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <BookOpen className="w-4 h-4" />
                Resources & Guides
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
                Property Management Resources
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
                Expert guides, tips, and best practices for landlords and property managers. Learn how to streamline rent collection, manage tenants, and grow your rental business.
              </p>
              
              {/* Search */}
              <div className="max-w-md mx-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search articles..."
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Blog Posts Grid */}
        <section className="py-12 px-4">
          <div className="container max-w-6xl">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {blogPosts.map((post) => (
                <Card key={post.slug} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="mb-3">
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">
                      {post.category}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-foreground mb-3 line-clamp-2">
                    {post.title}
                  </h2>
                  <p className="text-muted-foreground mb-4 line-clamp-3">
                    {post.description}
                  </p>
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                    <span>{post.publishDate}</span>
                    <span>{post.readTime}</span>
                  </div>
                  <Button variant="outline" size="sm" asChild className="w-full">
                    <Link to={`/resources/${post.slug}`}>
                      Read Article
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4">
          <div className="container max-w-4xl text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Ready to streamline your rent collection?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Start collecting rent online today with RentFlow. No credit card required.
            </p>
            <Button size="lg" asChild>
              <Link to="/signup">
                Get Started Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-4 border-t border-border bg-card">
          <div className="container max-w-6xl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">R</span>
                </div>
                <span className="font-semibold text-foreground">RentFlow</span>
              </div>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <Link to="/resources" className="hover:text-foreground transition-colors">Resources</Link>
                <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
                <a href="#" className="hover:text-foreground transition-colors">Terms</a>
                <a href="#" className="hover:text-foreground transition-colors">Support</a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
