export interface User {
  username: string;
  last_connect: string;
  api_token: boolean;
  is_active: boolean;
  is_su: boolean;

  mfa?: boolean;
}
