import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HelpCircle, MessageCircle, FileText, Video, ExternalLink } from 'lucide-react';

const helpResources = [
  {
    icon: Video,
    title: 'Video Tutorials',
    description: 'Watch step-by-step guides on how to use the platform',
    action: 'Watch Now',
  },
  {
    icon: FileText,
    title: 'Documentation',
    description: 'Read detailed guides and API documentation',
    action: 'Read Docs',
  },
  {
    icon: MessageCircle,
    title: 'Contact Support',
    description: 'Get help from our support team',
    action: 'Contact Us',
  },
];

const faqs = [
  {
    question: 'How do I add a new trading account?',
    answer: 'Click the "Add Account" button on the Overview page, select your account type, and fill in the details.',
  },
  {
    question: 'Can I connect my MT5 account?',
    answer: 'Yes! We support MT4, MT5, and cTrader platforms. Simply add your account and enter your server details.',
  },
  {
    question: 'How does the trade copier work?',
    answer: 'The trade copier automatically replicates trades from your master account to follower accounts with customizable risk settings.',
  },
  {
    question: 'Is my data secure?',
    answer: 'Absolutely. We use bank-level encryption and never store your trading credentials.',
  },
];

const Help = () => {
  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Help & Support</h1>
        <p className="text-muted-foreground">Get the help you need to succeed</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {helpResources.map((resource) => (
          <Card key={resource.title} className="border-border/50 bg-card/50 hover:border-primary/30 transition-colors">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <resource.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-medium text-foreground mb-1">{resource.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">{resource.description}</p>
                <Button variant="outline" size="sm">
                  {resource.action}
                  <ExternalLink className="ml-2 h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Frequently Asked Questions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="border-b border-border/50 last:border-0 pb-4 last:pb-0">
              <h4 className="font-medium text-foreground mb-1">{faq.question}</h4>
              <p className="text-sm text-muted-foreground">{faq.answer}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default Help;
