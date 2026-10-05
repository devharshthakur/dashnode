import {
  Link,
  useNavigate,
  useRouter,
  useRouterState,
} from '@tanstack/react-router'
import {
  FeatherIcon,
  HomeIcon,
  LogOutIcon,
  PenLineIcon,
  RssIcon,
} from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '#/components/ui/sidebar'
import { Spinner } from '#/components/ui/spinner'
import { useLogout } from '#lib/session'

import type { SessionUser } from '#lib/session'
import type { LucideIcon } from 'lucide-react'

// Only routes that exist are listed: a menu entry that leads nowhere is worse
// than no entry. A page added later gets its own item here.
const navigation: { title: string; to: string; icon: LucideIcon }[] = [
  { title: 'Feed', to: '/dashboard', icon: RssIcon },
  { title: 'Write', to: '/posts/new', icon: PenLineIcon },
  { title: 'Home', to: '/', icon: HomeIcon },
]

/** First character of a name, for the avatar placeholder. */
function initial(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || '?'
}

export function AppSidebar({ user }: { user: SessionUser }) {
  const navigate = useNavigate()
  const router = useRouter()
  const logout = useLogout()
  const { isMobile, setOpenMobile } = useSidebar()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 shrink-0 justify-center">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link to="/" />}
              tooltip="DashNode"
              aria-label="DashNode home"
              onClick={() => setOpenMobile(false)}
              className="group-data-[collapsible=icon]:justify-center"
            >
              <FeatherIcon />
              <span className="font-heading text-base group-data-[collapsible=icon]:hidden">
                DashNode
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Browse</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    render={<Link to={item.to} />}
                    isActive={pathname === item.to}
                    tooltip={item.title}
                    aria-label={item.title}
                    aria-current={pathname === item.to ? 'page' : undefined}
                    onClick={() => setOpenMobile(false)}
                  >
                    <item.icon />
                    <span className="group-data-[collapsible=icon]:hidden">
                      {item.title}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    aria-label={`Account menu for ${user.name}`}
                    className="group-data-[collapsible=icon]:justify-center"
                  />
                }
              >
                <Avatar className="size-6 shrink-0">
                  {user.avatarUrl === '' ? null : (
                    <AvatarImage src={user.avatarUrl} alt="" />
                  )}
                  <AvatarFallback>{initial(user.name)}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                side={isMobile ? 'top' : 'right'}
                className="w-56"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <span className="block truncate" title={user.email}>
                      {user.email}
                    </span>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={() => {
                      logout.mutate(undefined, {
                        onSuccess: async () => {
                          // Navigate before invalidating so the two do not
                          // race: the guest guard would otherwise see the
                          // cleared session and redirect mid-navigation.
                          await navigate({ to: '/', replace: true })
                          await router.invalidate()
                        },
                      })
                    }}
                  >
                    {logout.isPending ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <LogOutIcon data-icon="inline-start" />
                    )}
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
