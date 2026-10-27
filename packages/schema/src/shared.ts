import { type Static, type TSchema, Type } from '@sinclair/typebox';

export const LocaleSchema = Type.Union([
  Type.Literal('zh-TW'),
  Type.Literal('en'),
  Type.Literal('zh-CN'),
]);
export type Locale = Static<typeof LocaleSchema>;

export const LayoutSettingsSchema = Type.Object({
  menuPosition: Type.Union([Type.Literal('side'), Type.Literal('top')]),
  accent: Type.String(),
  sidebarCollapsible: Type.Boolean(),
  breadcrumbs: Type.Boolean(),
});
export type LayoutSettings = Static<typeof LayoutSettingsSchema>;

export interface MenuItem {
  title: string;
  /** lucide 圖示名稱，kebab-case */
  icon?: string;
  url?: string;
  children?: MenuItem[];
}

export const MenuItemSchema = Type.Recursive(
  (This) =>
    Type.Object({
      title: Type.String(),
      icon: Type.Optional(Type.String()),
      url: Type.Optional(Type.String()),
      children: Type.Optional(Type.Array(This)),
    }),
  { $id: 'MenuItem' },
) as unknown as TSchema & { static: MenuItem };

export const FlashSchema = Type.Object({
  id: Type.String(),
  type: Type.Union([
    Type.Literal('success'),
    Type.Literal('error'),
    Type.Literal('info'),
    Type.Literal('warning'),
  ]),
  message: Type.String(),
});
export type Flash = Static<typeof FlashSchema>;

export const SharedPropsSchema = Type.Object({
  brume: Type.Object({
    schemaVersion: Type.String(),
    app: Type.Object({
      name: Type.String(),
      locale: LocaleSchema,
      locales: Type.Array(LocaleSchema),
      homeUrl: Type.String(),
      logoutUrl: Type.String(),
      layout: LayoutSettingsSchema,
    }),
    auth: Type.Object({
      user: Type.Union([
        Type.Object({
          id: Type.Union([Type.String(), Type.Number()]),
          name: Type.String(),
          username: Type.String(),
          avatar: Type.Union([Type.String(), Type.Null()]),
        }),
        Type.Null(),
      ]),
    }),
    menu: Type.Array(MenuItemSchema),
    breadcrumbs: Type.Array(
      Type.Object({ title: Type.String(), url: Type.Optional(Type.String()) }),
    ),
    flash: Type.Union([FlashSchema, Type.Null()]),
  }),
});
export type SharedProps = Static<typeof SharedPropsSchema>;
