import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Building2, Users, CreditCard, BarChart3, Shield, Clock, CheckCircle2, ArrowRight, TrendingUp, Zap } from "lucide-react";
import heroImage from "@/assets/hero-apartment.jpg";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface SEOLandingPageProps {
  // SEO Meta
  title: string;
  description: string;
  canonicalUrl: string;
  h1: string;
  
  // Content
  introParagraphs: string[];
  featureBullets: string[];
  faqs: { question: string; answer: string }[];
  
  // Optional custom CTA text
  ctaText?: string;
}

const stats = [
  { value: "2,000+", label: "Property Managers" },
  { value: "$50M+", label: "Rent Processed" },
  { value: "99.9%", label: "Uptime" },
  { value: "24/7", label: "Support" },
];

const steps = [
  {
    title: "Create Your Account",
    description: "Sign up in seconds with just your email. No credit card required to start.",
  },
  {
    title: "Add Your Properties",
    description: "Import your properties and units, or add them manually with our easy forms.",
  },
  {
    title: "Start Collecting Rent",
    description: "Invite tenants and start collecting rent online with automatic reminders.",
  },
];

const features = [
  {
    icon: Building2,
    title: "Property Management",
    description: "Track all your properties, units, and maintenance requests in one centralized dashboard.",
  },
  {
    icon: Users,
    title: "Tenant Portal",
    description: "Give tenants a self-service portal to submit requests, view statements, and pay rent online.",
  },
  {
    icon: CreditCard,
    title: "Online Payments",
    description: "Accept rent payments online with automatic reminders and late fee calculations.",
  },
  {
    icon: BarChart3,
    title: "Financial Reports",
    description: "Generate detailed reports for income, expenses, and profitability across all properties.",
  },
  {
    icon: Shield,
    title: "Secure & Compliant",
    description: "Bank-level security with full compliance for handling sensitive tenant information.",
  },
  {
    icon: Clock,
    title: "Automated Workflows",
    description: "Automate lease renewals, payment reminders, and maintenance scheduling.",
  },
];

interface FeatureCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  delay: number;
}

const FeatureCard = ({ icon: Icon, title, description, delay }: FeatureCardProps) => (
  <div 
    className="group p-6 bg-card rounded-2xl shadow-card hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border border-border/50 animate-fade-in-up"
    style={{ animationDelay: `${delay}s` }}
  >
    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
      <Icon className="w-6 h-6 text-primary" />
    </div>
    <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
    <p className="text-muted-foreground">{description}</p>
  </div>
);

export function SEOLandingPage({
  title,
  description,
  canonicalUrl,
  h1,
  introParagraphs,
  featureBullets,
  faqs,
  ctaText = "Start for Free",
}: SEOLandingPageProps) {
  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonicalUrl} />
        
        {/* Open Graph / Facebook */}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:site_name" content="RentFlow" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
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
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
              <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">How It Works</a>
              <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
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
          <div className="container">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left Content */}
              <div className="max-w-xl">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 animate-fade-in">
                  <Zap className="w-4 h-4" />
                  Trusted by 2,000+ property managers
                </div>
                
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
                  {h1}
                </h1>
                
                {introParagraphs.map((paragraph, index) => (
                  <p key={index} className="text-lg text-muted-foreground mb-4 animate-fade-in-up" style={{ animationDelay: `${0.2 + index * 0.1}s` }}>
                    {paragraph}
                  </p>
                ))}

                <div className="flex flex-col sm:flex-row items-start gap-4 mb-8 animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
                  <Button size="lg" className="gap-2" asChild>
                    <Link to="/signup">
                      {ctaText}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </Button>
                </div>

                {/* Trust Indicators */}
                <div className="flex flex-col sm:flex-row gap-6 text-sm text-muted-foreground animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    No credit card required
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    Cancel anytime
                  </div>
                </div>
              </div>

              {/* Right Image */}
              <div className="relative animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
                <div className="relative rounded-2xl overflow-hidden shadow-card">
                  <img 
                    src={heroImage} 
                    alt="Modern apartment building at sunset" 
                    className="w-full h-auto object-cover"
                    loading="eager"
                    fetchPriority="high"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/20 to-transparent" />
                </div>
                
                {/* Floating Stats Card */}
                <div className="absolute -bottom-6 -left-6 bg-card rounded-xl shadow-card p-4 border border-border animate-float">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Processed</p>
                      <p className="text-lg font-bold text-foreground">$50M+</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Key Features Section */}
        {featureBullets.length > 0 && (
          <section className="py-20 px-4 bg-secondary/30">
            <div className="container max-w-4xl">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  Why Choose RentFlow
                </h2>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {featureBullets.map((bullet, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 bg-card rounded-lg border border-border">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-foreground">{bullet}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Features Grid */}
        <section id="features" className="py-20 px-4">
          <div className="container max-w-6xl">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                Features
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Everything you need to manage rentals
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                From tenant screening to rent collection, RentFlow has you covered with powerful tools designed for modern property managers.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <FeatureCard key={feature.title} {...feature} delay={index * 0.1} />
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-20 px-4 bg-secondary/30">
          <div className="container max-w-6xl">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                How It Works
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Get started in minutes
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Setting up RentFlow is quick and easy. Get your properties online and start collecting rent today.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {steps.map((step, index) => (
                <div key={step.title} className="text-center">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-primary">{index + 1}</span>
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        {faqs.length > 0 && (
          <section className="py-20 px-4">
            <div className="container max-w-3xl">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  Frequently Asked Questions
                </h2>
                <p className="text-muted-foreground text-lg">
                  Everything you need to know about RentFlow
                </p>
              </div>
              
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq, index) => (
                  <AccordionItem key={index} value={`item-${index}`} className="border-border">
                    <AccordionTrigger className="text-left font-semibold text-foreground">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </section>
        )}

        {/* Stats Section */}
        <section className="py-20 px-4 bg-primary/5">
          <div className="container max-w-6xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <p className="text-4xl md:text-5xl font-bold text-primary mb-2">{stat.value}</p>
                  <p className="text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4">
          <div className="container max-w-4xl text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Ready to get started?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join thousands of property managers using RentFlow to streamline their operations.
            </p>
            <Button size="lg" className="gap-2" asChild>
              <Link to="/signup">
                {ctaText}
                <ArrowRight className="w-4 h-4" />
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
