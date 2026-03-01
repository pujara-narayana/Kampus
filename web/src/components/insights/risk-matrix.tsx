"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";

interface Props {
    data: {
        courseId: string;
        courseName: string;
        avgDaysBeforeDue: number;
        avgGrade: number;
    }[];
}

export function RiskMatrix({ data }: Props) {
    if (!data || data.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Procrastination Risk Matrix</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                    Not enough historical grade data to plot risk matrix.
                </CardContent>
            </Card>
        );
    }

    // Calculate chart bounds to make it look nice
    const minX = Math.max(0, Math.min(...data.map(d => d.avgDaysBeforeDue)) - 1);
    const maxX = Math.max(...data.map(d => d.avgDaysBeforeDue)) + 1;
    const minY = Math.max(0, Math.min(...data.map(d => d.avgGrade)) - 10);
    const maxY = Math.min(100, Math.max(...data.map(d => d.avgGrade)) + 5);

    const getDotColor = (days: number, grade: number) => {
        if (days < 1.0 && grade < 80) return "#D00000"; // Danger: Procrastinating and failing (UNL Scarlet)
        if (days >= 2.0 && grade >= 80) return "#10B981"; // Excellent: Early and succeeding (Green)
        return "#F59E0B"; // Warning / Neutral (Amber)
    };

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white dark:bg-slate-950 p-3 rounded-lg border shadow-lg">
                    <p className="font-semibold text-sm mb-1">{data.courseName}</p>
                    <p className="text-xs text-muted-foreground">
                        Grade: <span className="font-medium text-foreground">{data.avgGrade.toFixed(1)}%</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Started: <span className="font-medium text-foreground">{data.avgDaysBeforeDue.toFixed(1)} days</span> early
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Procrastination Risk Matrix</CardTitle>
                <p className="text-xs text-muted-foreground">
                    Maps how early you start assignments vs. your course outcome. (Top Right = Ideal)
                </p>
            </CardHeader>
            <CardContent>
                <div className="h-[250px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />

                            <XAxis
                                type="number"
                                dataKey="avgDaysBeforeDue"
                                name="Days Started Early"
                                domain={[minX, maxX]}
                                tick={{ fontSize: 12, fill: 'currentColor', opacity: 0.6 }}
                                axisLine={false}
                                tickLine={false}
                            />

                            <YAxis
                                type="number"
                                dataKey="avgGrade"
                                name="Grade"
                                domain={[minY, maxY]}
                                tick={{ fontSize: 12, fill: 'currentColor', opacity: 0.6 }}
                                axisLine={false}
                                tickLine={false}
                            />

                            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: 'currentColor', opacity: 0.2 }} />

                            {/* Highlight Quadrants */}
                            <ReferenceLine y={80} stroke="currentColor" strokeOpacity={0.2} strokeDasharray="3 3" />
                            <ReferenceLine x={1.5} stroke="currentColor" strokeOpacity={0.2} strokeDasharray="3 3" />

                            <Scatter name="Courses" data={data}>
                                {data.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={getDotColor(entry.avgDaysBeforeDue, entry.avgGrade)}
                                        // Make dots larger if the class is severely failing
                                        r={entry.avgGrade < 70 ? 8 : 6}
                                        opacity={0.8}
                                    />
                                ))}
                            </Scatter>
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
