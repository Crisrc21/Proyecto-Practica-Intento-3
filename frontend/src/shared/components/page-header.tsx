interface PageHeaderProps {
  title: string;
  description: string;
  titleAction?: React.ReactNode;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, titleAction, action }: PageHeaderProps) {
  return (
    <div className="mb-7 flex flex-col gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-normal text-foreground sm:text-3xl">
            {title}
          </h1>
          {titleAction}
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
