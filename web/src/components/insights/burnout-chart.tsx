"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
    data: {
        date: string;
        studyHours: number;
        socialEvents: number;
        burnoutRisk: number;
    }[];
}

export function BurnoutChart({ data }: Props) {
    if (!data || data.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Burnout Detection</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                    Not enough historical data to generate burnout graph.
                </CardContent>
            </Card>
        );
    }

    // Find the max burnout risk for coloring
    const maxRisk = Math.max(...data.map(d => d.burnoutRisk));
    const isDanger = maxRisk > 75;

    return (
        <Card className={isDanger ? "border-orange-500/50" : ""}>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Burnout vs Social Battery</CardTitle>
                    {isDanger && (
                        <span className="text-xs font-semibold text-orange-600 bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded-full">
                            High Risk Detected
                        </span>
                    )}
                </div>
                <p className="text-xs text-muted-foreground">
                    Academic pressure mapped against your social interactions over the past 14 days.
                </p>
            </CardHeader>
            <CardContent>
                <div className="h-[250px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorStudy" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#D00000" stopOpacity={isDanger ? 0.6 : 0.3} />
                                    <stop offset="95%" stopColor="#D00000" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorSocial" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
                            <XAxis
                                dataKey="date"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={10}
                                className="text-xs fill-muted-foreground"
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                tickMargin={10}
                                className="text-xs fill-muted-foreground"
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                labelStyle={{ fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="studyHours"
                                stackId="1"
                                stroke="#D00000"
                                strokeWidth={2}
                                fill="url(#colorStudy)"
                                name="Study Hours"
                            />
                            <Area
                                type="monotone"
                                dataKey="socialEvents"
                                stackId="2"
                                stroke="#10B981"
                                strokeWidth={2}
                                fill="url(#colorSocial)"
                                name="Social Events"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
