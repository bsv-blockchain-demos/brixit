import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, MessageSquare, Users } from 'lucide-react';
import { AuthBackground } from '@/components/ui/AuthBackground';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const channels = [
  {
    icon: Mail,
    title: 'Email',
    body: 'For general questions, partnership inquiries, or support requests, reach us at hello@brix.community. We aim to respond within two business days.',
  },
  {
    icon: MessageSquare,
    title: 'General inquiries',
    body: 'Interested in bringing BRIX to your farm, market, or school? We would love to hear how you plan to use bionutrient data in your community.',
  },
  {
    icon: Users,
    title: 'Community',
    body: 'Join thousands of growers, shoppers, and researchers already sharing BRIX scores. Follow us on social media or check the community feed inside the app to connect with others.',
  },
];

export default function Contact() {
  const navigate = useNavigate();

  return (
    <AuthBackground>
      <div className="w-full max-w-xl mx-auto space-y-6 py-8 pb-20 self-start">

        {/* Back */}
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 -ml-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 bg-green-fresh rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
            <Mail className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-dark">Get in touch</h1>
          <p className="text-text-mid text-sm mt-1">We would love to hear from you</p>
        </div>

        {/* Contact channels */}
        {channels.map(({ icon: Icon, title, body }) => (
          <Card key={title}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className="w-5 h-5 text-green-fresh shrink-0" />
                {title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-text-mid leading-relaxed">{body}</p>
            </CardContent>
          </Card>
        ))}

        <p className="text-center text-xs text-text-muted pb-4">
          BRIX is an open community project. All feedback shapes what we build next.
        </p>

      </div>
    </AuthBackground>
  );
}
