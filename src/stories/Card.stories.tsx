import type { Meta, StoryObj } from "@storybook/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../components/ui/card";
import { Button } from "../components/ui/button";

const meta = {
  title: "UI/Card",
  component: Card,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description goes here</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Card content with any elements you want.</p>
      </CardContent>
      <CardFooter>
        <Button>Action</Button>
      </CardFooter>
    </Card>
  ),
};

export const AccountCard: Story = {
  render: () => (
    <Card className="w-[288px] bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Trading Account</CardTitle>
          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">FUNDED</span>
        </div>
        <CardDescription>Alpha Capital</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">SIZE</p>
            <p className="text-lg font-bold">$100,000</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">EQUITY</p>
            <p className="text-lg font-bold">$102,500</p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="bg-primary/10 rounded-b-lg">
        <p className="text-primary font-medium">+$2,500 (+2.5%)</p>
      </CardFooter>
    </Card>
  ),
};
