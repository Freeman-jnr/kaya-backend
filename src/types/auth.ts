export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: 'owner' | 'manager' | 'staff';
  businessId?: string | null;
}
