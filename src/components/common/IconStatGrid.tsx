import React from 'react';
import { Card, CardContent } from '../ui/card';

interface StatItem {
  icon: React.ComponentType<{ className?: string }>;
  value: React.ReactNode;
  label: string;
}

export function IconStatGrid({ stats }: { stats: StatItem[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {stats.map(({ icon: Icon, value, label }, i) => (
        <Card key={i} className="rounded-2xl border border-blue-pale shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-deep rounded-xl p-2">
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-text-dark">{value}</p>
                <p className="text-sm text-text-mid">{label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
