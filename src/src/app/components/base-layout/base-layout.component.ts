import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AvatarModule } from 'primeng/avatar';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { AuthService } from '../../services/auth.service';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-base-layout',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    ButtonModule,
    AvatarModule,
    MenuModule,
  ],
  templateUrl: './base-layout.component.html',
  styleUrl: './base-layout.component.scss',
})
export class BaseLayoutComponent {
  loggedUser: string = '';
  navigationItems: { routerLink: string; text: string }[] = [
    { routerLink: '/home', text: 'Dashboard' },
    { routerLink: '/programs', text: 'Programs' },
    { routerLink: '/pr', text: 'PR' },
    { routerLink: '/assistant', text: 'Assistant' },
    { routerLink: '/statistics', text: 'Statistics' },
  ];
  userMenuItems: MenuItem[] | undefined;
  isMobileMenuOpen = false;

  constructor(private authService: AuthService) {
    this.loggedUser = this.authService.loggedUser;
  }

  ngOnInit() {
    this.userMenuItems = [
      {
        label:
          this.loggedUser.charAt(0).toUpperCase() + this.loggedUser.slice(1),
        items: [
          {
            label: 'History',
            icon: 'pi pi-history',
            route: '/history',
          },
          {
            label: 'Stash',
            icon: 'pi pi-th-large',
            route: '/stash',
          },
          {
            label: 'Settings',
            icon: 'pi pi-cog',
            route: '/settings',
          },
          {
            label: 'Logout',
            icon: 'pi pi-sign-out',
            command: () => {
              this.authService.logout();
            },
          },
        ],
      },
    ];
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    document.body.classList.add('overflow-y-hidden');
  }

  closeMobileMenu() {
    this.isMobileMenuOpen = false;
    document.body.classList.remove('overflow-y-hidden');
  }
}
