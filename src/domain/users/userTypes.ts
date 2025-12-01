export interface UserDTO {
  UserID: number;
  FirstName: string | null;
  LastName: string | null;
  Email: string | null;
  RoleID: number | null;
  ProfilePic: string | null;
  IsActive: boolean;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface CreateUserInput {
  FirstName?: string;
  LastName?: string;
  Email: string;
  Password: string;
  RoleID?: number | null;
  ProfilePic?: string | null;
  IsActive?: boolean;
}

export interface UpdateUserInput {
  FirstName?: string | null;
  LastName?: string | null;
  Email?: string | null;
  Password?: string; // optional, if present → rehash
  RoleID?: number | null;
  ProfilePic?: string | null;
  IsActive?: boolean;
}
