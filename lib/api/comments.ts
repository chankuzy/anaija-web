import { api } from "./client";

// Contracts read from comments-list / -replies / -store / -like / -destroy.
export interface CommentAuthor {
  id: number;
  name: string | null;
  username: string | null;
  avatar: string | null;
}
export interface Comment {
  id: number;
  body: string;
  likes_count: number;
  replies_count: number;
  is_liked: boolean;
  created_at: string;
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
  create: (postId: number, body: string, parentId?: number) =>
    api.post<Comment>(`comments-store/${postId}`, parentId ? { body, parent_id: parentId } : { body }),
  like: (id: number) => api.post<{ liked: boolean; likes_count: number }>(`comments-like/${id}`, {}),
  remove: (id: number) => api.delete<{ message: string }>(`comments-destroy/${id}`),
};
