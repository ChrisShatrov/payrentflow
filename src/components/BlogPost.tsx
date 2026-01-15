import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Clock, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";

interface BlogPostProps {
  title: string;
  description: string;
  canonicalUrl: string;
  publishDate: string;
  readTime: string;
  content: React.ReactNode;
  relatedLinks?: { title: string; url: string }[];
}

export function BlogPost({
  title,
  description,
  canonicalUrl,
  publishDate,
  readTime,
  content,
  relatedLinks = [],
}: BlogPostProps) {
  return (
    <>
      <Helmet>
        <title>{title} — RentFlow Blog</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonicalUrl} />
        
        {/* Open Graph */}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={canonicalUrl} />
        
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
              <a href="/#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
              <a href="/#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">How It Works</a>
              <a href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
              <Link to="/resources" className="text-muted-foreground hover:text-foreground transition-colors">Resources</Link>
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

        {/* Article Content */}
        <article className="pt-24 pb-20 px-4">
          <div className="container max-w-4xl">
            {/* Back to Resources */}
            <Button variant="ghost" size="sm" className="mb-8" asChild>
              <Link to="/resources">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Resources
              </Link>
            </Button>

            {/* Article Header */}
            <header className="mb-12">
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 leading-tight">
                {title}
              </h1>
              
              <div className="flex items-center gap-6 text-muted-foreground mb-8">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>{publishDate}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>{readTime} read</span>
                </div>
              </div>

              <p className="text-xl text-muted-foreground leading-relaxed">
                {description}
              </p>
            </header>

            {/* Article Body */}
            <div className="prose prose-lg dark:prose-invert max-w-none mb-12 prose-headings:font-bold prose-headings:text-foreground prose-p:text-foreground prose-p:leading-relaxed prose-ul:list-disc prose-ol:list-decimal prose-li:text-foreground prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-strong:text-foreground prose-strong:font-semibold">
              {content}
            </div>

            {/* Related Links */}
            {relatedLinks.length > 0 && (
              <Card className="p-6 mb-12">
                <h2 className="text-2xl font-bold text-foreground mb-4">Related Resources</h2>
                <ul className="space-y-3">
                  {relatedLinks.map((link, index) => (
                    <li key={index}>
                      <Link
                        to={link.url}
                        className="text-primary hover:underline flex items-center gap-2"
                      >
                        {link.title}
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* CTA */}
            <Card className="p-8 bg-primary/5 border-primary/20">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Ready to streamline your rent collection?
              </h2>
              <p className="text-muted-foreground mb-6">
                Start collecting rent online today with RentFlow. No credit card required.
              </p>
              <Button size="lg" asChild>
                <Link to="/signup">
                  Get Started Free
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </Card>
          </div>
        </article>

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
