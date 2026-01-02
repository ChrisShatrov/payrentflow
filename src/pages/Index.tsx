import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Building2, Users, CreditCard, BarChart3, Shield, Clock } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-hero rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">RentFlow</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
            <a href="#about" className="text-muted-foreground hover:text-foreground transition-colors">About</a>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/auth">Sign In</Link>
            </Button>
            <Button variant="default" size="sm" asChild>
              <Link to="/auth">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 animate-fade-in">
            <Shield className="w-4 h-4" />
            Trusted by 2,000+ property managers
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
            Property Management
            <span className="block text-gradient">Made Simple</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
            Streamline your rental operations with RentFlow. Manage tenants, collect payments, and track properties—all in one powerful platform.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
            <Button size="lg" asChild>
              <Link to="/auth">Start Free Trial</Link>
            </Button>
            <Button variant="outline" size="lg">
              Watch Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-4">
        <div className="container max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Everything you need to manage rentals
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              From tenant screening to rent collection, RentFlow has you covered.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <FeatureCard key={feature.title} {...feature} delay={index * 0.1} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container max-w-4xl">
          <div className="bg-gradient-hero rounded-3xl p-10 md:p-16 text-center shadow-glow">
            <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
              Ready to simplify your rentals?
            </h2>
            <p className="text-primary-foreground/80 text-lg mb-8 max-w-xl mx-auto">
              Join thousands of property managers who trust RentFlow to handle their rental business.
            </p>
            <Button 
              size="lg" 
              className="bg-card text-primary hover:bg-card/90 shadow-lg"
              asChild
            >
              <Link to="/auth">Get Started Free</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-hero rounded-md flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">RentFlow</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2026 RentFlow. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

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
    className="group p-6 bg-card rounded-2xl shadow-card hover:shadow-lg transition-all duration-300 hover:-translate-y-1 animate-fade-in-up"
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
