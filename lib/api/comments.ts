import { api } from "./client";

// Contracts read from comments-list / -replies / -store / -like / -destroy / -edit / -resolve.
export interface CommentAuthor {
  id: number;
  name: string | null;
  username: string | null;
  avatar: string | null;
}
/** Reply images exist only on Course Desk questions. The server returns absolute URLs. */
export interface CommentMedia {
  id: number;
  url: string;
  width: number | null;
  height: number | null;
  aspect_ratio: number | null;
}
export interface CommentMediaInput {
  storage_key: string;
  width: number;
  height: number;
  aspect_ratio: number;
  size_bytes: number;
  mime_type: string;
}
export interface Comment {
  id: number;
  body: string;
  likes_count: number;
  replies_count: number;
  is_liked: boolean;
  created_at: string;
  edited_at?: string | null;
  media?: CommentMedia[];
  author: CommentAuthor;
  pending?: boolean;
}
export interface CommentPage {
  data: Comment[];
  next_cursor?: string | null;
  has_more?: boolean;
  message?: string; // "Comments are disabled." arrives as { data: [], message }
}

export const commentsApi = {
  list: (postId: number, cursor?: string | null) => api.get<CommentPage>(`comments-list/${postId}`, { cursor }),
  replies: (commentId: number, cursor?: string | null) =>
    api.get<CommentPage>(`comments-replies/${commentId}`, { cursor }),
  create: (postId: number, body: string, parentId?: number, media?: CommentMediaInput[]) =>
    api.post<Comment>(`comments-store/${postId}`, {
      body,
      ...(parentId ? { parent_id: parentId } : {}),
      ...(media && media.length ? { media } : {}),
    }),
  edit: (id: number, body: string) => api.post<Comment>(`comments-edit/${id}`, { body }),
  /** Course Desk questions: the author or a course team member marks the question answered / reopens it. */
  resolve: (postId: number, resolved: boolean) => api.post<{ resolved: boolean }>(`comments-resolve/${postId}`, { resolved }),
  like: (id: number) => api.post<{ liked: boolean; likes_count: number }>(`comments-like/${id}`, {}),
  remove: (id: number) => api.delete<{ message: string }>(`comments-destroy/${id}`),
};
