// Plain serializable shapes passed from server components to client components.

export type RoomListItem = {
  id: string;
  name: string;
  updatedAt: string;
  files: number;
  folders: number;
  bytes: number;
  shared: boolean;
};

export type BrowserFolder = {
  id: string;
  name: string;
  updatedAt: string;
};

export type BrowserFile = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  updatedAt: string;
  versions: number;
};

/** Breadcrumb segment; id === null means the room root. */
export type Crumb = {
  id: string | null;
  name: string;
};

export type TreeFolder = {
  id: string;
  name: string;
  parentId: string | null;
};

export type SearchResults = {
  folders: { id: string; name: string; location: string }[];
  files: {
    id: string;
    name: string;
    size: number;
    mimeType: string;
    location: string;
  }[];
};

export type ShareState = {
  public: { id: string; token: string } | null;
  restricted: {
    id: string;
    token: string;
    grants: { id: string; email: string }[];
  } | null;
};

export type ShareResource = {
  type: "ROOM" | "FOLDER" | "FILE";
  id: string;
  name: string;
};
