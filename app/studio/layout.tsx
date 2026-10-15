export default function StudioLayout({ children }: LayoutProps<"/studio">) {
  return (
    <>
      <header>Studio placeholder header</header>
      <main>{children}</main>
    </>
  );
}
