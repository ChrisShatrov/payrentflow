import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Users, CreditCard, BarChart3, Shield, Clock, CheckCircle2, ArrowRight, TrendingUp, Zap, Mail, Send, DollarSign, Check } from "lucide-react";
import heroImage from "@/assets/hero-apartment.jpg";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: "success" | "error" | null; message: string }>({ type: null, message: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !subject.trim() || !message.trim()) {
      setSubmitStatus({ type: "error", message: "Please fill in all fields" });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setSubmitStatus({ type: "error", message: "Please enter a valid email address" });
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: "" });

    try {
      const { data, error } = await supabase.functions.invoke("send-contact-email", {
        body: { email: email.trim(), subject, message },
      });

      if (error) {
        throw error;
      }

      setSubmitStatus({ type: "success", message: "Thank you! Your message has been sent successfully." });
      setEmail("");
      setSubject("");
      setMessage("");
    } catch (error: any) {
      console.error("Error sending contact email:", error);
      setSubmitStatus({ 
        type: "error", 
        message: error.message || "Failed to send message. Please try again later." 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Online Rent Payments & Property Management Software | RentFlow</title>
        <meta
          name="description"
          content="Collect rent online, automate late fees, track payments, and manage properties all in one place. Trusted by 2,000+ property managers."
        />
        <link rel="canonical" href="https://www.payrentflow.com/" />
        
        {/* Open Graph / Facebook */}
        <meta property="og:title" content="Online Rent Payments & Property Management Software | RentFlow" />
        <meta property="og:description" content="Collect rent online, automate late fees, track payments, and manage properties all in one place. Trusted by 2,000+ property managers." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.payrentflow.com/" />
        <meta property="og:site_name" content="RentFlow" />
        {/* TODO: Add og:image when you have a social sharing image */}
        {/* <meta property="og:image" content="https://www.payrentflow.com/og-image.jpg" /> */}
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Online Rent Payments & Property Management Software | RentFlow" />
        <meta name="twitter:description" content="Collect rent online, automate late fees, track payments, and manage properties all in one place. Trusted by 2,000+ property managers." />
        {/* TODO: Add twitter:image when you have a social sharing image */}
        {/* <meta name="twitter:image" content="https://www.payrentflow.com/og-image.jpg" /> */}
      </Helmet>
      <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="RentFlow" className="w-12 h-12" />
            <h1 className="text-3xl font-extrabold tracking-tight">
              <span className="text-primary">Rent</span>
              <span className="text-foreground">Flow</span>
            </h1>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">How It Works</a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
            <a href="#contact" className="text-muted-foreground hover:text-foreground transition-colors">Contact Us</a>
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
                Property Management
                <span className="block text-primary">Made Simple</span>
              </h1>
              
              <p className="text-lg text-muted-foreground mb-8 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
                Streamline your rental operations with RentFlow. Manage tenants, collect payments, and track properties—all in one powerful platform.
              </p>

              <div className="flex flex-col sm:flex-row items-start gap-4 mb-8 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
                <Button size="lg" className="gap-2" asChild>
                  <Link to="/signup">
                    Start for Free
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </div>

              {/* Trust Indicators */}
              <div className="flex flex-col sm:flex-row gap-6 text-sm text-muted-foreground animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
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
                    <p className="text-2xl font-bold text-foreground">$2.4M+</p>
                    <p className="text-xs text-muted-foreground">Rent collected monthly</p>
                  </div>
                </div>
              </div>

              {/* Floating Properties Card */}
              <div className="absolute -top-4 -right-4 bg-card rounded-xl shadow-card p-4 border border-border animate-float" style={{ animationDelay: "0.5s" }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">5,000+</p>
                    <p className="text-xs text-muted-foreground">Properties managed</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Banner */}
      <section className="py-12 px-4">
        <div className="container">
          <div className="bg-primary rounded-2xl p-8 md:p-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {stats.map((stat, index) => (
                <div key={stat.label} className="animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                  <p className="text-3xl md:text-4xl font-bold text-primary-foreground">{stat.value}</p>
                  <p className="text-primary-foreground/70 text-sm mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

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
        <div className="container max-w-5xl">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              How It Works
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Get started in minutes
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Setting up RentFlow is quick and easy. Start managing your properties today.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <div key={step.title} className="relative text-center animate-fade-in-up" style={{ animationDelay: `${index * 0.15}s` }}>
                <div className="w-16 h-16 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                  {index + 1}
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%] border-t-2 border-dashed border-border" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4">
        <div className="container max-w-6xl">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              <DollarSign className="w-4 h-4" />
              Pricing
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              No hidden fees, no membership costs, no surprises. Pay only when tenants pay.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Pricing Card */}
            <Card className="p-8 border-2 border-primary/20 hover:border-primary/40 transition-all">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <DollarSign className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-2">Pay-As-You-Go</h3>
                <p className="text-muted-foreground">Only pay when tenants make payments</p>
              </div>

              <div className="space-y-6 mb-8">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">No Monthly Fees</p>
                    <p className="text-sm text-muted-foreground">Zero membership or license fees</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">No Setup Costs</p>
                    <p className="text-sm text-muted-foreground">Get started completely free</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Tenants Pay Fees</p>
                    <p className="text-sm text-muted-foreground">Processing fees are paid by tenants, not you</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Fee Breakdown Card */}
            <Card className="p-8 border-2 border-border hover:shadow-lg transition-all">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-foreground mb-2">Payment Processing Fees</h3>
                <p className="text-muted-foreground">Clear, upfront pricing</p>
              </div>

              <div className="space-y-6">
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-primary" />
                      <span className="font-semibold text-foreground">Credit/Debit Cards</span>
                    </div>
                    <span className="text-2xl font-bold text-primary">3.75%</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Per transaction, paid by tenant</p>
                </div>

                <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-primary" />
                      <span className="font-semibold text-foreground">ACH Bank Transfer</span>
                    </div>
                    <span className="text-2xl font-bold text-primary">$5</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Flat fee per transaction, paid by tenant</p>
                </div>

                <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-green-900 dark:text-green-100">Cheaper Than Competitors</p>
                      <p className="text-sm text-green-700 dark:text-green-300">No monthly subscriptions or hidden fees for property owners. Save thousands compared to traditional property management software.</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div className="text-center mt-12">
            <p className="text-muted-foreground mb-6">
              All core features included at no additional cost
            </p>
            <Button size="lg" asChild>
              <Link to="/signup">
                Get Started Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container max-w-4xl">
          <div className="bg-primary rounded-3xl p-10 md:p-16 text-center shadow-glow relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50" />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
                Ready to simplify your rentals?
              </h2>
              <p className="text-primary-foreground/80 text-lg mb-8 max-w-xl mx-auto">
                Join thousands of property managers who trust RentFlow to handle their rental business.
              </p>
              <Button 
                size="lg" 
                className="bg-card text-primary hover:bg-card/90 shadow-lg gap-2"
                asChild
              >
                <Link to="/signup">
                  Get Started Free
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 px-4 bg-secondary/30">
        <div className="container max-w-4xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              <Mail className="w-4 h-4" />
              Get in Touch
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Contact Us
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
            </p>
          </div>

          <Card className="p-6 md:p-8">
            <CardContent className="p-0">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                    Your Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isSubmitting}
                    className="w-full"
                  />
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-foreground mb-2">
                    Subject
                  </label>
                  <Input
                    id="subject"
                    type="text"
                    placeholder="What is this regarding?"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    disabled={isSubmitting}
                    className="w-full"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-foreground mb-2">
                    Message
                  </label>
                  <Textarea
                    id="message"
                    placeholder="Tell us more about your question or inquiry..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    disabled={isSubmitting}
                    rows={6}
                    className="w-full resize-none"
                  />
                </div>

                {submitStatus.type && (
                  <div
                    className={`p-4 rounded-lg ${
                      submitStatus.type === "success"
                        ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800"
                        : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800"
                    }`}
                  >
                    {submitStatus.message}
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  className="w-full gap-2"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Message
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="RentFlow" className="w-10 h-10" />
              <span className="font-semibold text-foreground">RentFlow</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="hover:text-foreground transition-colors">Support</a>
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
};

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

export default Index;
