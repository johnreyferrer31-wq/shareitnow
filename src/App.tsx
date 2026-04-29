import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  setDoc,
  increment,
  where,
  getDocs,
  getDoc,
  writeBatch,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { 
  onAuthStateChanged, 
  User
} from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Heart, 
  MessageCircle, 
  User as UserIcon, 
  UserPlus,
  UserCheck,
   Bell,
  Clock,
  Check,
  Shield,
  Home, 
  PlusSquare, 
  LogOut, 
  Share2,
  Search,
  Users,
  Settings,
  Image as ImageIcon,
  X,
  Send,
  MoreVertical,
  MessageSquare
} from 'lucide-react';
import { auth, db, signInWithGoogle, signInWithGoogleRedirect, checkRedirectResult, logOut } from './lib/firebase';

// Helper for errors
const handleFirestoreError = (error: any, operation: string, path: string | null = null) => {
  if (error.code === 'permission-denied') {
    const errorInfo = {
      error: error.message,
      operationType: operation,
      path: path,
      authInfo: {
        userId: auth.currentUser?.uid || 'anonymous',
        email: auth.currentUser?.email || '',
        emailVerified: auth.currentUser?.emailVerified || false,
        isAnonymous: auth.currentUser?.isAnonymous ?? true,
        providerInfo: auth.currentUser?.providerData.map(p => ({
          providerId: p.providerId,
          displayName: p.displayName || '',
          email: p.email || ''
        })) || []
      }
    };
    throw new Error(JSON.stringify(errorInfo));
  }
  throw error;
};

// Types
interface Post {
  id: string;
  userId: string;
  userName: string;
  userPhotoURL: string;
  imageUrl: string;
  caption: string;
  likesCount: number;
  createdAt: any;
  hasLiked?: boolean;
}

interface Comment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: any;
}

interface Notification {
  id: string;
  fromId: string;
  fromName: string;
  type: 'follow' | 'follow_request' | 'like' | 'comment';
  read: boolean;
  createdAt: any;
}

interface FollowRequest {
  fromId: string;
  fromName: string;
  createdAt: any;
}

interface Conversation {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageAt?: any;
  lastSenderId?: string;
  readBy?: string[];
  participantDetails?: Record<string, { name: string, photo?: string }>;
  updatedAt: any;
}

interface ChatMessage {
  id: string;
  fromId: string;
  fromName: string;
  text: string;
  imageUrl?: string;
  createdAt: any;
}

// Components
const PostCard = ({ post, currentUser, customProfiles, customNames, onProfileClick, onMessageClick }: { post: Post, currentUser: User, customProfiles: Record<string, string>, customNames: Record<string, string>, onProfileClick: (uid: string, name: string) => void, onMessageClick: (uid: string, name: string) => void, key?: string }) => {
  const [isLiked, setIsLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showLikers, setShowLikers] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [likers, setLikers] = useState<{ userId: string, userName?: string }[]>([]);
  const [commentText, setCommentText] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    // Check if user liked
    const likeRef = doc(db, `posts/${post.id}/likes`, currentUser.uid);
    const unsubscribe = onSnapshot(likeRef, (doc) => {
      setIsLiked(doc.exists());
    });
    return unsubscribe;
  }, [post.id, currentUser.uid]);

  useEffect(() => {
    if (showComments) {
      const q = query(collection(db, `posts/${post.id}/comments`), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)));
      });
      return unsubscribe;
    }
  }, [showComments, post.id]);

  useEffect(() => {
    if (showLikers) {
      const q = query(collection(db, `posts/${post.id}/likes`), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setLikers(snapshot.docs.map(doc => ({ userId: doc.id, ...doc.data() } as any)));
      });
      return unsubscribe;
    }
  }, [showLikers, post.id]);

  const handleLike = async () => {
    try {
      const likeRef = doc(db, `posts/${post.id}/likes`, currentUser.uid);
      const postRef = doc(db, 'posts', post.id);

      if (isLiked) {
        await deleteDoc(likeRef);
        await updateDoc(postRef, { likesCount: increment(-1) });
      } else {
        await setDoc(likeRef, {
          userId: currentUser.uid,
          userName: currentUser.displayName || 'Anonymous',
          createdAt: serverTimestamp()
        });
        await updateDoc(postRef, { likesCount: increment(1) });
      }
    } catch (e) {
      handleFirestoreError(e, isLiked ? 'delete' : 'create', `posts/${post.id}/likes/${currentUser.uid}`);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    try {
      await addDoc(collection(db, `posts/${post.id}/comments`), {
        userId: currentUser.uid,
        userName: currentUser.displayName || 'Anonymous',
        text: commentText,
        createdAt: serverTimestamp()
      });
      setCommentText('');
    } catch (e) {
      handleFirestoreError(e, 'create', `posts/${post.id}/comments`);
    }
  };

  const handleDeletePost = async () => {
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'posts', post.id));
      setShowMenu(false);
      setShowDeleteConfirm(false);
      alert('Post deleted successfully');
    } catch (e: any) {
      console.error("Delete error:", e);
      alert(`Error deleting post: ${e.message || 'Unknown error'}`);
      handleFirestoreError(e, 'delete', `posts/${post.id}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface rounded-3xl mx-4 my-3 overflow-hidden shadow-lg border border-border"
    >
      {/* Header */}
      <div 
        className="flex items-center px-4 py-3 gap-3 cursor-pointer group"
        onClick={() => onProfileClick(post.userId, customNames[post.userId] || post.userName)}
      >
        <div className="w-10 h-10 rounded-full bg-border overflow-hidden ring-2 ring-primary/20 group-hover:ring-primary transition-all">
          {customProfiles[post.userId] || post.userPhotoURL ? (
            <img src={customProfiles[post.userId] || post.userPhotoURL} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary text-bg font-bold text-sm">
              {(customNames[post.userId] || post.userName).substring(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-sm text-ink group-hover:text-primary transition-colors">{customNames[post.userId] || post.userName}</span>
          <span className="text-[10px] text-ink-muted">Shared a photo</span>
        </div>
        <div className="ml-auto relative" ref={menuRef}>
          <MoreVertical 
            className="w-5 h-5 text-ink-muted cursor-pointer hover:text-primary transition-colors" 
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          />
          <AnimatePresence>
            {showMenu && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                className="absolute right-0 top-full mt-2 w-48 bg-surface border border-border rounded-2xl shadow-xl z-[60] overflow-hidden"
              >
                <div 
                  className="px-4 py-3 text-xs font-bold text-ink hover:bg-bg cursor-pointer transition-colors flex items-center gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    const url = `${window.location.origin}/post/${post.id}`;
                    navigator.clipboard.writeText(url);
                    alert('Post link copied!');
                    setShowMenu(false);
                  }}
                >
                  <Share2 className="w-3.5 h-3.5 text-primary" />
                  Copy Post Link
                </div>
                {post.userId === currentUser.uid && (
                  <button 
                    disabled={isDeleting}
                    className={`w-full px-4 py-3 text-xs font-bold transition-all flex items-center gap-2 border-t border-border ${showDeleteConfirm ? 'bg-red-500 text-white hover:bg-red-600 font-bold' : 'text-red-500 hover:bg-red-50'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (showDeleteConfirm) {
                        handleDeletePost();
                      } else {
                        setShowDeleteConfirm(true);
                      }
                    }}
                    onMouseLeave={() => setShowDeleteConfirm(false)}
                  >
                    {isDeleting ? (
                      <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <X className="w-3.5 h-3.5" />
                    )}
                    {isDeleting ? 'Deleting...' : (showDeleteConfirm ? 'Confirm Delete?' : 'Delete Post')}
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Image */}
      <div className="aspect-square bg-bg flex items-center justify-center overflow-hidden">
         <img src={post.imageUrl} className="w-full h-full object-cover" alt="Post" referrerPolicy="no-referrer" />
      </div>

      {/* Actions */}
      <div className="px-4 py-3">
        <div className="flex gap-5 mb-3 items-center">
          <div className="flex items-center gap-1.5 cursor-pointer group">
            <Heart 
              onClick={handleLike}
              className={`w-6 h-6 transition-all ${isLiked ? 'fill-primary text-primary scale-110' : 'text-ink-muted group-hover:text-primary'}`} 
            />
            <button 
              onClick={() => setShowLikers(true)}
              className="text-sm font-semibold hover:text-primary transition-colors hover:underline"
            >
              {post.likesCount}
            </button>
          </div>
          <div className="flex items-center gap-1.5 cursor-pointer group" onClick={() => setShowComments(!showComments)}>
            <MessageCircle className="w-6 h-6 text-ink-muted group-hover:text-primary" />
            <span className="text-sm font-semibold">{comments.length}</span>
          </div>
          <div className="flex items-center gap-1.5 cursor-pointer group" onClick={() => onMessageClick(post.userId, post.userName)}>
            <MessageSquare className="w-6 h-6 text-ink-muted group-hover:text-primary" />
          </div>
          <div 
            className="cursor-pointer group ml-auto"
            onClick={async () => {
              const shareData = {
                title: 'Check out this post on ShareItNow',
                text: post.caption,
                url: window.location.href,
              };
              if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
                try {
                  await navigator.share(shareData);
                } catch (err) {
                  console.log('Share failed:', err);
                }
              } else {
                navigator.clipboard.writeText(window.location.href);
                alert('Link copied to clipboard!');
              }
            }}
          >
            <Share2 className="w-6 h-6 text-ink-muted hover:text-primary transition-colors" />
          </div>
        </div>
        
        <div className="text-sm leading-relaxed text-ink">
          <span className="font-bold mr-2">{post.userName}</span>
          <span className="text-ink/90">{post.caption}</span>
        </div>

        {comments.length > 0 && !showComments && (
          <div 
            className="mt-2 text-[13px] text-primary/80 font-medium cursor-pointer hover:text-primary transition-colors" 
            onClick={() => setShowComments(true)}
          >
            View all {comments.length} comments
          </div>
        )}
      </div>

      {/* Comments Section */}
      <AnimatePresence>
        {showComments && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 pb-4 overflow-hidden bg-bg/50 border-t border-border"
          >
            <div className="max-h-60 overflow-y-auto py-3 space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="text-xs">
                  <span className="font-bold text-primary mr-2">{comment.userName}</span>
                  <span className="text-ink/80">{comment.text}</span>
                </div>
              ))}
            </div>
            
            <form onSubmit={handleAddComment} className="flex gap-2 mt-2">
              <input 
                type="text" 
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 text-xs bg-bg border border-border rounded-full px-4 py-2 focus:outline-none focus:border-primary transition-colors"
              />
              <button disabled={!commentText.trim()} className="text-primary font-bold text-xs px-3 disabled:opacity-50">
                Post
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Likers Overlay */}
      <AnimatePresence>
        {showLikers && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/80 backdrop-blur-sm"
          >
            <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="w-full max-w-sm bg-surface rounded-[2.5rem] border border-border shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-border flex justify-between items-center bg-primary/5">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <h3 className="font-bold uppercase tracking-widest text-sm">Liked By</h3>
                </div>
                <button onClick={() => setShowLikers(false)} className="p-2 hover:bg-bg rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
                {likers.length === 0 ? (
                  <div className="py-12 text-center text-ink-muted italic opacity-40">No likes yet</div>
                ) : (
                  likers.map((liker) => (
                    <div 
                      key={liker.userId} 
                      onClick={() => {
                        onProfileClick(liker.userId, liker.userName || 'User');
                        setShowLikers(false);
                      }}
                      className="flex items-center gap-3 p-3 bg-bg/50 rounded-2xl hover:bg-bg transition-colors cursor-pointer group border border-transparent hover:border-border"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs ring-2 ring-primary/5 group-hover:ring-primary/20 transition-all overflow-hidden shrink-0">
                        {customProfiles[liker.userId] ? (
                          <img src={customProfiles[liker.userId]} alt="" className="w-full h-full object-cover" />
                        ) : (
                          liker.userName?.substring(0, 1).toUpperCase()
                        )}
                      </div>
                      <span className="font-bold text-sm tracking-tight">{liker.userName || 'User'}</span>
                      <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                        <Check className="w-4 h-4 text-primary" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const UploadView = ({ onComplete, onCancel, user }: { onComplete: () => void, onCancel: () => void, user: User }) => {
  const [image, setImage] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Max dimension 1200px
          const MAX_DIM = 1200;
          if (width > height) {
            if (width > MAX_DIM) {
              height *= MAX_DIM / width;
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width *= MAX_DIM / height;
              height = MAX_DIM;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Compress quality to 0.7 to fit comfortably in 1MB
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setImage(dataUrl);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!image || loading) return;
    setLoading(true);

    try {
      await addDoc(collection(db, 'posts'), {
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        userPhotoURL: user.photoURL || '',
        imageUrl: image, // Note: Limited to 1MB in Firestore
        caption: caption,
        likesCount: 0,
        createdAt: serverTimestamp()
      });
      onComplete();
    } catch (e) {
      handleFirestoreError(e, 'create', 'posts');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 flex flex-col h-full bg-bg">
      <div className="flex justify-between items-center mb-10 border-b border-border pb-4">
        <h2 className="text-2xl font-bold tracking-tight text-ink">Create Post</h2>
        <X className="cursor-pointer w-7 h-7 text-ink-muted hover:text-white transition-colors" onClick={onCancel} />
      </div>

      <div 
        className="aspect-square rounded-3xl bg-surface border-2 border-border flex flex-col items-center justify-center mb-8 overflow-hidden relative group cursor-pointer shadow-lg"
        onClick={() => fileRef.current?.click()}
      >
        {image ? (
          <img src={image} className="w-full h-full object-cover" alt="Selected" />
        ) : (
          <div className="flex flex-col items-center group-hover:scale-110 transition-transform">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
               <ImageIcon className="w-8 h-8 text-primary" />
            </div>
            <span className="text-sm font-bold text-ink-muted">Tap to select photo</span>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
      </div>

      <div className="space-y-3 mb-10">
        <label className="text-xs font-bold text-ink uppercase tracking-widest ml-1">Caption</label>
        <textarea 
          placeholder="What's on your mind?"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="w-full p-5 bg-surface border border-border rounded-3xl text-ink focus:outline-none focus:border-primary text-sm leading-relaxed placeholder:text-ink-muted transition-colors"
          rows={4}
        />
      </div>

      <button 
        onClick={handleUpload}
        disabled={!image || loading}
        className="w-full bg-primary text-bg py-5 rounded-3xl font-bold text-lg shadow-xl shadow-primary/20 disabled:opacity-30 transition-all active:scale-95 flex items-center justify-center gap-3"
      >
        {loading ? (
          <div className="w-6 h-6 border-3 border-bg border-t-transparent rounded-full animate-spin"></div>
        ) : (
          <>
            <PlusSquare className="w-6 h-6" />
            <span>Share Now</span>
          </>
        )}
      </button>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'feed' | 'profile' | 'upload' | 'visit'>('feed');
  const [selectedProfile, setSelectedProfile] = useState<{uid: string, name: string} | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [authError, setAuthError] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchUsers, setSearchUsers] = useState<any[]>([]);
  const [customProfiles, setCustomProfiles] = useState<Record<string, string>>({});
  const [customNames, setCustomNames] = useState<Record<string, string>>({});
  const [profileLoading, setProfileLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [visitedUserProfile, setVisitedUserProfile] = useState<any>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [followersList, setFollowersList] = useState<any[]>([]);
  const [showFollowers, setShowFollowers] = useState(false);
  const [isRequested, setIsRequested] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<FollowRequest[]>([]);
  const [showRequests, setShowRequests] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showConversations, setShowConversations] = useState(false);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatImage, setChatImage] = useState<string | null>(null);
  const [isChatImageUploading, setIsChatImageUploading] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);

  // Fetch real-time notifications
  useEffect(() => {
    if (user) {
      const qNotif = query(
        collection(db, `users/${user.uid}/notifications`), 
        orderBy('createdAt', 'desc')
      );
      const unsubNotif = onSnapshot(qNotif, (snapshot) => {
        setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));
      });

      const qReq = query(
        collection(db, `users/${user.uid}/requests`),
        orderBy('createdAt', 'desc')
      );
      const unsubReq = onSnapshot(qReq, (snapshot) => {
        setIncomingRequests(snapshot.docs.map(doc => ({ ...doc.data() } as FollowRequest)));
      });

      const qConv = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', user.uid),
        orderBy('updatedAt', 'desc')
      );
      const unsubConv = onSnapshot(qConv, (snapshot) => {
        setConversations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation)));
      });

      return () => {
        unsubNotif();
        unsubReq();
        unsubConv();
      };
    }
  }, [user]);

  // Messages listener for active chat
  useEffect(() => {
    if (user && activeConversation) {
      const q = query(
        collection(db, `conversations/${activeConversation.id}/messages`),
        orderBy('createdAt', 'asc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setChatMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage)));
      });
      return unsubscribe;
    } else {
      setChatMessages([]);
    }
  }, [user, activeConversation]);

  const markNotificationsRead = async () => {
    if (!user) return;
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;
    
    const batch = writeBatch(db);
    unread.forEach(n => {
      batch.update(doc(db, `users/${user.uid}/notifications`, n.id), { read: true });
    });
    try { await batch.commit(); } catch (e) { console.error(e); }
  };

  // Fetch custom profile photos and names for users in view
  useEffect(() => {
    const fetchProfiles = async () => {
      const uids = new Set<string>(posts.map(p => p.userId));
      conversations.forEach(c => c.participants.forEach(p => uids.add(p)));
      if (user) uids.add(user.uid);
      
      const newProfiles = { ...customProfiles };
      const newNames = { ...customNames };
      let changed = false;

      for (const uid of Array.from(uids)) {
        if (!newProfiles[uid] || !newNames[uid]) {
          try {
            const userDoc = await getDoc(doc(db, 'users', uid));
            if (userDoc.exists()) {
              const data = userDoc.data();
              if (data.customPhotoURL && newProfiles[uid] !== data.customPhotoURL) {
                newProfiles[uid] = data.customPhotoURL;
                changed = true;
              }
              if (data.displayName && newNames[uid] !== data.displayName) {
                newNames[uid] = data.displayName;
                changed = true;
              }
            }
          } catch (e) {
            console.error("Error fetching profile for", uid, e);
          }
        }
      }

      if (changed) {
        setCustomProfiles(newProfiles);
        setCustomNames(newNames);
      }
    };

    if (posts.length > 0 || user || conversations.length > 0) {
      fetchProfiles();
    }
  }, [posts, user, conversations]);

  // Global user search logic
  useEffect(() => {
    const searchGlobalUsers = async () => {
      if (searchQuery.length < 2) {
        setSearchUsers([]);
        return;
      }

      try {
        // Fetch users matching query (simple prefix-like search using query/where)
        // Since Firestore doesn't support easy case-insensitive includes, we'll do our best
        const q = query(
          collection(db, 'users'), 
          orderBy('displayName'),
          where('displayName', '>=', searchQuery),
          where('displayName', '<=', searchQuery + '\uf8ff')
        );
        
        const snapshot = await getDocs(q);
        setSearchUsers(snapshot.docs.map(d => d.data()).filter(u => u.userId !== user?.uid));
      } catch (err) {
        console.error("User search error:", err);
      }
    };

    const timer = setTimeout(searchGlobalUsers, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, user]);

  // Track follow status and visited profile data
  useEffect(() => {
    if (view === 'visit' && selectedProfile && user) {
      // Check if following
      const followRef = doc(db, `users/${user.uid}/following`, selectedProfile.uid);
      const unsubFollow = onSnapshot(followRef, (d) => setIsFollowing(d.exists()));
      
      // Check if requested
      const requestRef = doc(db, `users/${selectedProfile.uid}/requests`, user.uid);
      const unsubRequest = onSnapshot(requestRef, (d) => setIsRequested(d.exists()));

      // Get visited user counts/data
      const userRef = doc(db, 'users', selectedProfile.uid);
      const unsubUser = onSnapshot(userRef, (d) => {
        if (d.exists()) setVisitedUserProfile(d.data());
      });
      
      return () => {
        unsubFollow();
        unsubRequest();
        unsubUser();
      };
    } else if (view === 'profile' && user) {
      // Get own counts/data
       const userRef = doc(db, 'users', user.uid);
       const unsubUser = onSnapshot(userRef, (d) => {
         if (d.exists()) setVisitedUserProfile(d.data());
       });
       return unsubUser;
    }
  }, [view, selectedProfile, user]);

  const fetchFollowers = async () => {
    const targetUid = view === 'profile' ? user?.uid : selectedProfile?.uid;
    if (!targetUid) return;
    
    try {
      const q = query(collection(db, `users/${targetUid}/followers`));
      const snapshot = await getDocs(q);
      const followerIds = snapshot.docs.map(doc => doc.id);
      
      const followersData: any[] = [];
      for (const fUid of followerIds) {
        const uDoc = await getDoc(doc(db, 'users', fUid));
        if (uDoc.exists()) {
          followersData.push(uDoc.data());
        } else {
          followersData.push({ userId: fUid, displayName: 'User' });
        }
      }
      setFollowersList(followersData);
      setShowFollowers(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleFollow = async () => {
    if (!user || !selectedProfile) return;
    const batch = writeBatch(db);
    
    const myFollowingRef = doc(db, `users/${user.uid}/following`, selectedProfile.uid);
    const theirFollowersRef = doc(db, `users/${selectedProfile.uid}/followers`, user.uid);
    const myRef = doc(db, 'users', user.uid);
    const theirRef = doc(db, 'users', selectedProfile.uid);
    const requestRef = doc(db, `users/${selectedProfile.uid}/requests`, user.uid);

    if (isFollowing) {
      batch.delete(myFollowingRef);
      batch.delete(theirFollowersRef);
      batch.update(myRef, { followingCount: increment(-1), updatedAt: serverTimestamp() });
      batch.update(theirRef, { followersCount: increment(-1), updatedAt: serverTimestamp() });
    } else if (isRequested) {
      // Cancel request
      batch.delete(requestRef);
    } else {
      if (visitedUserProfile?.isPrivate) {
        // Send request
        batch.set(requestRef, {
          fromId: user.uid,
          fromName: user.displayName || 'User',
          createdAt: serverTimestamp()
        });

        // Add notification to their subcollection
        const notifRef = doc(collection(db, `users/${selectedProfile.uid}/notifications`));
        batch.set(notifRef, {
          fromId: user.uid,
          fromName: user.displayName || 'User',
          type: 'follow_request',
          read: false,
          createdAt: serverTimestamp()
        });
      } else {
        // Public follow
        batch.set(myFollowingRef, { uid: selectedProfile.uid, createdAt: serverTimestamp() });
        batch.set(theirFollowersRef, { uid: user.uid, createdAt: serverTimestamp() });
        
        batch.set(myRef, { 
          userId: user.uid,
          displayName: user.displayName || 'User',
          followingCount: increment(1),
          updatedAt: serverTimestamp() 
        }, { merge: true });

        batch.set(theirRef, { 
          userId: selectedProfile.uid,
          displayName: selectedProfile.name || 'User',
          followersCount: increment(1),
          updatedAt: serverTimestamp() 
        }, { merge: true });

        // Add notification to their subcollection
        const notifRef = doc(collection(db, `users/${selectedProfile.uid}/notifications`));
        batch.set(notifRef, {
          fromId: user.uid,
          fromName: user.displayName || 'User',
          type: 'follow',
          read: false,
          createdAt: serverTimestamp()
        });
      }
    }

    try {
      await batch.commit();
    } catch (e) {
      console.error(e);
      handleFirestoreError(e, isFollowing ? 'delete' : 'create', 'follow');
    }
  };

  const handleAcceptRequest = async (request: FollowRequest) => {
    if (!user) return;
    const batch = writeBatch(db);
    
    const myFollowerRef = doc(db, `users/${user.uid}/followers`, request.fromId);
    const theirFollowingRef = doc(db, `users/${request.fromId}/following`, user.uid);
    const myRef = doc(db, 'users', user.uid);
    const theirRef = doc(db, 'users', request.fromId);
    const requestRef = doc(db, `users/${user.uid}/requests`, request.fromId);

    batch.set(myFollowerRef, { uid: request.fromId, createdAt: serverTimestamp() });
    batch.set(theirFollowingRef, { uid: user.uid, createdAt: serverTimestamp() });
    
    batch.update(myRef, { followersCount: increment(1), updatedAt: serverTimestamp() });
    batch.update(theirRef, { followingCount: increment(1), updatedAt: serverTimestamp() });
    
    batch.delete(requestRef);

    // Notify them of acceptance
    const notifRef = doc(collection(db, `users/${request.fromId}/notifications`));
    batch.set(notifRef, {
      fromId: user.uid,
      fromName: user.displayName || 'User',
      type: 'follow',
      read: false,
      createdAt: serverTimestamp()
    });

    try {
      await batch.commit();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRejectRequest = async (requesterId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/requests`, requesterId));
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartChat = async (targetUid: string, targetName: string) => {
    if (!user) return;
    
    // Sort UIDs to have a consistent conversation ID
    const conversationId = [user.uid, targetUid].sort().join('_');
    const convRef = doc(db, 'conversations', conversationId);
    
    try {
      setChatError(null);
      const convSnap = await getDoc(convRef);
      
      // Get target user details for the conversation doc
      const targetDoc = await getDoc(doc(db, 'users', targetUid));
      const targetData = targetDoc.data();
      
      const details = {
        [user.uid]: { name: user.displayName || 'User', photo: (user as any).customPhotoURL || user.photoURL || '' },
        [targetUid]: { name: targetName, photo: targetData?.customPhotoURL || '' }
      };

      if (!convSnap.exists()) {
        await setDoc(convRef, {
          id: conversationId,
          participants: [user.uid, targetUid],
          participantDetails: details,
          updatedAt: serverTimestamp(),
          readBy: [user.uid]
        });
      } else {
        await updateDoc(convRef, {
          readBy: arrayUnion(user.uid),
          participantDetails: details // Keep it fresh
        });
      }
      setActiveConversation({ 
        id: conversationId, 
        participants: [user.uid, targetUid], 
        participantDetails: details,
        updatedAt: new Date() 
      });
      setShowConversations(false);
    } catch (e: any) {
      console.error(e);
      setChatError(e.message || 'Failed to start chat');
      handleFirestoreError(e, 'create', 'conversation');
    }
  };

  const visitchatProfile = (conv: Conversation) => {
    if (!user) return;
    const otherId = conv.participants.find(p => p !== user.uid);
    if (!otherId) return;
    
    const details = conv.participantDetails?.[otherId];
    handleProfileClick(otherId, details?.name || 'User');
    setActiveConversation(null);
    setShowConversations(false);
  };

  const handleChatImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.[0]) return;
    setIsChatImageUploading(true);
    
    try {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = async (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          const maxDim = 600;
          if (width > height) {
            if (width > maxDim) {
              height *= maxDim / width;
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width *= maxDim / height;
              height = maxDim;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.5);
          setChatImage(compressedDataUrl);
          setIsChatImageUploading(false);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error(err);
      setChatError(`Image upload failed: ${err.message}`);
      setIsChatImageUploading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!user || !activeConversation || (!newMessage.trim() && !chatImage) || isSendingMessage) return;
    
    setIsSendingMessage(true);
    const messageText = newMessage.trim() || (chatImage ? 'Photo' : '');
    setChatError(null);
    
    const batch = writeBatch(db);
    const messageRef = doc(collection(db, `conversations/${activeConversation.id}/messages`));
    
    const messageData: any = {
      fromId: user.uid,
      fromName: user.displayName || 'User',
      text: messageText,
      createdAt: serverTimestamp()
    };

    if (chatImage) {
      messageData.imageUrl = chatImage;
    }
    
    batch.set(messageRef, messageData);
    
    batch.update(doc(db, 'conversations', activeConversation.id), {
      lastMessage: chatImage ? '📷 Photo' : messageText,
      lastMessageAt: serverTimestamp(),
      lastSenderId: user.uid,
      readBy: [user.uid],
      updatedAt: serverTimestamp()
    });
    
    try {
      await batch.commit();
      setNewMessage('');
      setChatImage(null);
    } catch (e: any) {
      console.error(e);
      setChatError(e.message || 'Failed to send message');
      handleFirestoreError(e, 'create', 'message');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleProfilePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.[0]) return;
    setProfileLoading(true);
    
    try {
      const file = e.target.files[0];
      const reader = new FileReader();

      reader.onload = async (event) => {
        const img = new Image();
        img.onload = async () => {
          // Compress for profile (smaller than posts)
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 400; // Smaller size for profile
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6);

          // Update Firestore users collection
          await setDoc(doc(db, 'users', user.uid), {
            userId: user.uid,
            displayName: user.displayName || 'User',
            customPhotoURL: compressedDataUrl,
            updatedAt: serverTimestamp()
          });

          setCustomProfiles(prev => ({ ...prev, [user.uid]: compressedDataUrl }));
          setProfileLoading(false);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error(err);
      setAuthError(`Profile upload failed: ${err.message}`);
      setProfileLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || saveLoading) return;
    
    setSaveLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: editName.trim() || user.displayName,
        username: editUsername.trim().toLowerCase(),
        bio: editBio.trim(),
        updatedAt: serverTimestamp()
      });
      setIsEditingProfile(false);
    } catch (e: any) {
      console.error(e);
      handleFirestoreError(e, 'update', `users/${user.uid}`);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleProfileClick = (uid: string, name: string) => {
    if (user && uid === user.uid) {
      setView('profile');
    } else {
      setSelectedProfile({ uid, name });
      setView('visit');
    }
  };

  const handleGoogleAuth = async () => {
    setAuthError('');
    try {
      await signInWithGoogle();
    } catch (error: any) {
      if (error.code === 'auth/popup-blocked') {
        setAuthError('POPUP BLOCKED: Please allow popups for this site to login with Google.');
      } else {
        setAuthError(`GOOGLE ERROR: ${error.message}`);
      }
    }
  };

  useEffect(() => {
    checkRedirectResult().catch((error) => {
      setAuthError(`REDIRECT ERROR: ${error.message}`);
    });

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        // Initialize/Update user profile record on login
        try {
          await setDoc(doc(db, 'users', u.uid), {
            userId: u.uid,
            displayName: u.displayName || 'User',
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (e) {
          console.error("Profile init error:", e);
        }
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user && view !== 'upload') {
      let q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
      if (view === 'profile') {
        q = query(collection(db, 'posts'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
      } else if (view === 'visit' && selectedProfile) {
        q = query(collection(db, 'posts'), where('userId', '==', selectedProfile.uid), orderBy('createdAt', 'desc'));
      }
      
      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post)));
          setIsOffline(false);
        },
        (error) => {
          if (error.code === 'unavailable') {
            setIsOffline(true);
          }
          console.error("Firestore error:", error);
        }
      );
      return unsubscribe;
    }
  }, [user, view]);

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-body">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!user) return (
    <div className="mobile-container flex flex-col items-center justify-center p-12 bg-bg text-center">
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-24 h-24 bg-linear-to-tr from-primary to-primary/60 rounded-[2rem] flex items-center justify-center mb-10 shadow-2xl shadow-primary/20 ring-4 ring-white/10"
      >
        <Share2 className="w-12 h-12 text-bg" />
      </motion.div>
      
      <div className="space-y-2 mb-16">
        <div className="flex items-center justify-center gap-3">
           <div className="w-8 h-8 bg-linear-to-tr from-primary to-primary/60 rounded-xl flex items-center justify-center shadow-lg shadow-primary/30">
             <Share2 className="w-5 h-5 text-bg" />
           </div>
           <h1 className="text-4xl font-extrabold tracking-tighter text-ink italic">shareit <span className="text-primary not-italic">now</span></h1>
        </div>
        <p className="text-ink-muted text-sm font-medium tracking-wide">simple photo sharing • like • comment</p>
      </div>

      {authError && (
        <div className="mx-2 mb-10 p-5 bg-red-500/10 border border-red-500/30 rounded-3xl text-red-500 text-xs font-medium text-center space-y-3">
          <div className="font-bold uppercase tracking-widest flex items-center justify-center gap-2">
            <span>⚠️ Login Blocked</span>
          </div>
          <p className="opacity-90 leading-relaxed">
            Your browser blocked the Google login window. For the best experience, please **open this app in a new tab** using the button in the top right corner of the preview.
          </p>
          <button 
            onClick={() => {
              setAuthError('');
              signInWithGoogleRedirect();
            }}
            className="text-primary font-bold underline hover:no-underline transition-all"
          >
            Or try login using redirect
          </button>
        </div>
      )}
      
      <motion.button 
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleGoogleAuth}
        className="w-full bg-primary text-bg py-5 rounded-full font-bold text-lg shadow-xl shadow-primary/20 flex items-center justify-center relative transition-all"
      >
        <span>Proceed</span>
      </motion.button>
    </div>
  );

  return (
    <div className="mobile-container overflow-hidden flex flex-col h-screen">
      {isOffline && (
        <div className="bg-amber-500 text-bg py-1.5 px-4 text-[10px] font-bold uppercase tracking-widest text-center animate-pulse">
          Offline Mode • Trying to reconnect...
        </div>
      )}
      {/* Header */}
      <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur-xl border-b border-white/5 px-6 py-5 flex justify-between items-center">
         <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-linear-to-tr from-primary to-primary/60 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <Share2 className="w-5 h-5 text-bg" />
            </div>
            <h1 className="font-extrabold text-xl tracking-tighter italic">shareit <span className="text-primary not-italic">now</span></h1>
         </div>
        <div className="flex items-center gap-4">
           {/* Notifications Bell */}
           <div className="relative">
             <motion.div 
               whileTap={{ scale: 0.9 }}
               onClick={() => {
                 setShowNotifications(!showNotifications);
                 if (!showNotifications) markNotificationsRead();
               }}
               className="relative text-ink-muted p-2 rounded-xl cursor-pointer hover:bg-surface transition-colors"
             >
               <Bell className="w-5 h-5" />
               {notifications.some(n => !n.read) && (
                 <motion.span 
                   initial={{ scale: 0.8 }}
                   animate={{ scale: [0.8, 1.1, 0.8] }}
                   transition={{ repeat: Infinity, duration: 2 }}
                   className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-bg shadow-sm"
                 ></motion.span>
               )}
             </motion.div>
             
             <AnimatePresence>
               {showNotifications && (
                 <motion.div 
                   initial={{ opacity: 0, y: 10, scale: 0.95, x: '-50%' }}
                   animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
                   exit={{ opacity: 0, y: 10, scale: 0.95, x: '-50%' }}
                   className="absolute left-1/2 mt-3 w-80 bg-surface border border-border rounded-[2.5rem] shadow-2xl z-50 overflow-hidden"
                 >
                   <div className="p-4 border-b border-border flex justify-between items-center">
                     <span className="text-xs font-bold uppercase tracking-widest text-ink/60">Notifications</span>
                     <button onClick={() => setShowNotifications(false)} className="text-ink-muted hover:text-ink">
                       <X className="w-3 h-3" />
                     </button>
                   </div>
                   <div className="max-h-80 overflow-y-auto">
                     {notifications.length === 0 ? (
                       <div className="p-8 text-center text-xs text-ink-muted italic opacity-40">No notifications yet</div>
                     ) : (
                       notifications.map(n => (
                         <div 
                           key={n.id} 
                           onClick={() => {
                             handleProfileClick(n.fromId, n.fromName);
                             setShowNotifications(false);
                           }}
                           className={`p-4 flex items-center gap-3 hover:bg-bg transition-colors cursor-pointer border-b border-border/50 last:border-0 ${!n.read ? 'bg-primary/5' : ''}`}
                         >
                           <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                             {n.type === 'follow_request' ? <Clock className="w-5 h-5 text-amber-500" /> : <UserPlus className="w-5 h-5 text-primary" />}
                           </div>
                           <div className="flex flex-col">
                             <p className="text-xs text-ink">
                               <span className="font-bold">{n.fromName}</span> {n.type === 'follow_request' ? 'requested to follow you.' : 'started following you.'}
                             </p>
                             <span className="text-[10px] text-ink-muted opacity-60">
                               {n.createdAt?.toDate().toLocaleDateString()}
                             </span>
                           </div>
                         </div>
                       ))
                     )}
                   </div>
                 </motion.div>
               )}
             </AnimatePresence>
           </div>

           {/* Direct Messages Icon */}
           <motion.div 
             whileTap={{ scale: 0.9 }}
             onClick={() => setShowConversations(!showConversations)}
             className="relative text-ink-muted p-2 rounded-xl cursor-pointer hover:bg-surface transition-colors"
           >
             <MessageSquare className="w-5 h-5" />
             {conversations.some(conv => 
               conv.lastMessage && 
               conv.lastSenderId !== user?.uid && 
               !(conv.readBy || []).includes(user?.uid || '')
             ) && (
               <motion.span 
                 initial={{ scale: 0.8 }}
                 animate={{ scale: [0.8, 1.1, 0.8] }}
                 transition={{ repeat: Infinity, duration: 2 }}
                 className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-bg shadow-sm"
               ></motion.span>
             )}
           </motion.div>

           {!showSearch && (
             <motion.div 
               whileTap={{ scale: 0.9 }}
               onClick={() => setShowSearch(true)}
               className="text-ink-muted p-2 rounded-xl cursor-pointer hover:bg-surface transition-colors"
             >
               <Search className="w-5 h-5" />
             </motion.div>
           )}
           {view === 'profile' ? (
             <div 
               className="bg-red-500/10 text-red-500 p-2 rounded-xl cursor-pointer hover:bg-red-500/20 transition-colors" 
               onClick={logOut}
             >
               <LogOut className="w-5 h-5" />
             </div>
           ) : (
             <motion.div 
               whileTap={{ scale: 0.9 }}
               onClick={() => setView('upload')}
               className="bg-primary/10 text-primary p-2 rounded-xl cursor-pointer hover:bg-primary/20 transition-colors"
             >
               <PlusSquare className="w-5 h-5" />
             </motion.div>
           )}
        </div>
      </header>

      <AnimatePresence>
        {showSearch && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-6 py-3 bg-bg border-b border-border overflow-hidden"
          >
            <div className="relative flex items-center">
              <Search className="absolute left-4 w-4 h-4 text-ink-muted" />
              <input 
                type="text"
                placeholder="Search posts or users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full bg-surface py-3 pl-11 pr-10 rounded-2xl text-sm focus:outline-none focus:ring-1 focus:ring-primary border border-transparent transition-all"
              />
              <button 
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery('');
                }}
                className="absolute right-3 p-1 text-ink-muted hover:text-primary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto mb-[85px] scrollbar-hide">
        <AnimatePresence mode="wait">
          {view === 'upload' ? (
            <motion.div 
              key="upload"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-0 z-50 bg-bg"
            >
              <UploadView user={user} onComplete={() => setView('feed')} onCancel={() => setView('feed')} />
            </motion.div>
          ) : (
            <motion.div 
              key={view}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="pb-8"
            >
              {(view === 'profile' || view === 'visit') && (
                <div className="bg-surface/50 border-b border-border py-10 px-6 flex flex-col items-center relative">
                  {view === 'visit' && (
                    <motion.div 
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setView('feed')}
                      className="absolute top-6 left-6 p-2 bg-surface rounded-xl border border-border cursor-pointer text-ink-muted hover:text-primary transition-colors"
                    >
                      <X className="w-5 h-5 rotate-90" /> {/* Back icon using X rotated */}
                    </motion.div>
                  )}
                  <div className="relative mb-6">
                    {view === 'profile' ? (
                      <label className="cursor-pointer group relative block">
                        <div className="w-28 h-28 rounded-full border-4 border-primary/20 p-1 group-hover:border-primary transition-all overflow-hidden bg-bg relative">
                          <img 
                            src={customProfiles[user.uid] || user.photoURL || null} 
                            alt="Profile" 
                            className={`w-full h-full rounded-full object-cover transition-opacity ${profileLoading ? 'opacity-30' : 'group-hover:opacity-60'}`} 
                            referrerPolicy="no-referrer" 
                          />
                          {profileLoading ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Camera className="w-8 h-8 text-white drop-shadow-lg" />
                            </div>
                          )}
                        </div>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={handleProfilePicUpload} 
                          disabled={profileLoading} 
                        />
                      </label>
                    ) : (
                      <div className="w-28 h-28 rounded-full border-4 border-primary/20 p-1 overflow-hidden bg-bg">
                        <img 
                          src={customProfiles[selectedProfile?.uid || ''] || null} 
                          alt="Profile" 
                          className="w-full h-full rounded-full object-cover" 
                          referrerPolicy="no-referrer" 
                        />
                      </div>
                    )}
                    <div className="absolute bottom-1 right-1 w-7 h-7 bg-primary rounded-full border-4 border-bg flex items-center justify-center">
                      <div className="w-2 h-2 bg-bg rounded-full animate-pulse"></div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center mb-4">
                    <h1 className="text-3xl font-black italic tracking-tighter uppercase leading-none text-ink text-center">
                      {view === 'profile' ? (visitedUserProfile?.displayName || user.displayName) : (customNames[selectedProfile?.uid || ''] || selectedProfile?.name)}
                    </h1>
                    <div className="text-primary font-bold text-[10px] mt-2 uppercase tracking-[0.3em] opacity-80">
                      @{view === 'profile' ? (visitedUserProfile?.username || user.displayName?.replace(/\s+/g, '').toLowerCase()) : (visitedUserProfile?.username || selectedProfile?.name?.replace(/\s+/g, '').toLowerCase())}
                    </div>
                    {visitedUserProfile?.bio && (
                      <p className="text-sm text-ink-muted mt-3 px-10 text-center leading-relaxed">
                        {visitedUserProfile.bio}
                      </p>
                    )}
                  </div>
                  
                  {view === 'profile' && (
                    <div className="flex flex-wrap items-center justify-center gap-4 mt-2 mb-6 px-6">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          const newStatus = !visitedUserProfile?.isPrivate;
                          updateDoc(doc(db, 'users', user.uid), { isPrivate: newStatus, updatedAt: serverTimestamp() });
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-bold uppercase tracking-wider transition-all border ${
                          visitedUserProfile?.isPrivate 
                          ? 'bg-primary/10 text-primary border-primary/30' 
                          : 'bg-surface text-ink-muted border-border'
                        }`}
                      >
                        {visitedUserProfile?.isPrivate ? <Shield className="w-3 h-3" /> : <Shield className="w-3 h-3 opacity-30" />}
                        <span>{visitedUserProfile?.isPrivate ? 'Private Profile' : 'Public Profile'}</span>
                      </motion.button>
                      
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setEditName(visitedUserProfile?.displayName || user.displayName || '');
                          setEditUsername(visitedUserProfile?.username || user.displayName?.replace(/\s+/g, '').toLowerCase() || '');
                          setEditBio(visitedUserProfile?.bio || '');
                          setIsEditingProfile(true);
                        }}
                        className="flex items-center gap-2 px-6 py-2 rounded-2xl bg-surface text-ink border border-border text-[10px] font-bold uppercase tracking-wider hover:border-primary/50 transition-colors"
                      >
                        <Settings className="w-3 h-3 text-primary" />
                        <span>Edit Profile</span>
                      </motion.button>

                      {incomingRequests.length > 0 && (
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setShowRequests(true)}
                          className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider animate-pulse"
                        >
                          <Clock className="w-3 h-3" />
                          <span>{incomingRequests.length} Request{incomingRequests.length > 1 ? 's' : ''}</span>
                        </motion.button>
                      )}
                    </div>
                  )}

                  <p className="text-ink-muted text-xs font-semibold mt-1 mb-8 tracking-widest uppercase opacity-60">
                    {view === 'profile' ? (visitedUserProfile?.username ? `@${visitedUserProfile.username}` : user.email) : 'ShareItNow Member'}
                  </p>
                  
                  <div className="flex gap-12">
                    <div className="text-center group">
                      <div className="font-extrabold text-2xl group-hover:text-primary transition-colors">{posts.length}</div>
                      <div className="text-ink-muted text-[10px] uppercase font-bold tracking-[0.2em] opacity-40 group-hover:opacity-100">Post</div>
                    </div>
                    <div className="text-center group cursor-pointer" onClick={fetchFollowers}>
                      <div className="font-extrabold text-2xl text-primary">{visitedUserProfile?.followersCount || 0}</div>
                      <div className="text-ink-muted text-[10px] uppercase font-bold tracking-[0.2em] opacity-40 group-hover:opacity-100">Followers</div>
                    </div>
                    <div className="text-center group">
                      <div className="font-extrabold text-2xl text-primary">{visitedUserProfile?.followingCount || 0}</div>
                      <div className="text-ink-muted text-[10px] uppercase font-bold tracking-[0.2em] opacity-40 group-hover:opacity-100">Following</div>
                    </div>
                  </div>

                  {view === 'visit' && (
                    <div className="flex gap-4 mt-8">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={handleFollow}
                        className={`px-8 py-3 rounded-full font-bold text-sm tracking-widest uppercase transition-all flex items-center gap-2 ${
                          isFollowing 
                          ? 'bg-surface text-primary border border-primary' 
                          : isRequested
                          ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30'
                          : 'bg-primary text-bg'
                        }`}
                      >
                        {isFollowing ? (
                          <>
                            <UserCheck className="w-4 h-4" />
                            <span>Following</span>
                          </>
                        ) : isRequested ? (
                          <>
                            <Clock className="w-4 h-4" />
                            <span>Requested</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4" />
                            <span>Follow</span>
                          </>
                        )}
                      </motion.button>

                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleStartChat(selectedProfile!.uid, selectedProfile!.name)}
                        className="px-8 py-3 rounded-full font-bold text-sm tracking-widest uppercase bg-surface text-primary border border-primary flex items-center gap-2"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>Message</span>
                      </motion.button>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex flex-col pt-2">
                {/* User Search Results */}
                {searchUsers.length > 0 && (
                  <div className="px-6 py-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-muted mb-4">Found Users</h3>
                    <div className="flex flex-col gap-4">
                      {searchUsers.map(u => (
                        <div 
                          key={u.userId}
                          onClick={() => {
                            handleProfileClick(u.userId, u.displayName);
                            setShowSearch(false);
                            setSearchQuery('');
                          }}
                          className="flex items-center gap-3 cursor-pointer group"
                        >
                          <div className="w-12 h-12 rounded-full overflow-hidden bg-surface border border-border">
                            <img 
                              src={u.customPhotoURL || null} 
                              alt="" 
                              className="w-full h-full object-cover" 
                              referrerPolicy="no-referrer" 
                            />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm text-ink group-hover:text-primary transition-colors">{u.displayName}</span>
                            <span className="text-[10px] text-ink-muted opacity-60">@{u.username || u.displayName?.replace(/\s+/g, '').toLowerCase()}</span>
                          </div>
                          <div className="ml-auto p-2 bg-surface rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                             <UserIcon className="w-4 h-4 text-primary" />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="h-px bg-border my-6 opacity-30" />
                  </div>
                )}

                {posts
                  .filter(post => 
                    post.caption.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    post.userName.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map(post => (
                    <PostCard key={post.id} post={post} currentUser={user!} customProfiles={customProfiles} customNames={customNames} onProfileClick={handleProfileClick} onMessageClick={handleStartChat} />
                  ))}
                
                {posts.length > 0 && posts.filter(post => 
                  post.caption.toLowerCase().includes(searchQuery.toLowerCase()) || 
                  post.userName.toLowerCase().includes(searchQuery.toLowerCase())
                ).length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-ink-muted opacity-40">
                    <Search className="w-12 h-12 mb-4" />
                    <p className="text-sm font-bold tracking-widest uppercase italic">No results found for "{searchQuery}"</p>
                  </div>
                )}

                {posts.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-32 text-ink-muted opacity-30 space-y-4">
                    <ImageIcon className="w-16 h-16 animate-pulse" />
                    <p className="text-sm font-bold tracking-widest uppercase italic">The directory is empty</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-6 left-6 right-6 bg-surface/80 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] px-8 py-4 flex justify-between items-center z-40 shadow-2xl">
        <motion.div 
          whileTap={{ scale: 0.8 }}
          onClick={() => setView('feed')}
          className={`group flex flex-col items-center gap-1 cursor-pointer transition-all ${view === 'feed' ? 'text-primary' : 'text-ink-muted hover:text-white'}`}
        >
          <Home className={`w-6 h-6 ${view === 'feed' ? 'fill-primary' : ''}`} />
          <span className="text-[9px] font-bold uppercase tracking-widest">Home</span>
        </motion.div>
        
        <motion.div 
          whileTap={{ scale: 0.9, rotate: 90 }}
          onClick={() => setView('upload')}
          className="w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/30 -mt-10 border-4 border-bg group"
        >
          <div className="text-3xl font-bold text-bg">+</div>
        </motion.div>

        <motion.div 
          whileTap={{ scale: 0.8 }}
          onClick={() => setView('profile')}
          className={`group flex flex-col items-center gap-1 cursor-pointer transition-all relative ${view === 'profile' ? 'text-primary' : 'text-ink-muted hover:text-white'}`}
        >
          <UserIcon className={`w-6 h-6 ${view === 'profile' ? 'fill-primary' : ''}`} />
          {notifications.some(n => !n.read) && (
            <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-bg"></span>
          )}
          <span className="text-[9px] font-bold uppercase tracking-widest">User</span>
        </motion.div>
      </nav>

      <AnimatePresence>
        {showFollowers && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4"
          >
            <motion.div 
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="w-full max-w-sm bg-surface border border-border rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-border flex justify-between items-center">
                <h3 className="font-bold uppercase tracking-widest text-sm">Followers</h3>
                <button onClick={() => setShowFollowers(false)} className="p-2 hover:bg-bg rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
                {followersList.length === 0 ? (
                  <div className="py-10 text-center text-ink-muted italic opacity-40">No followers found</div>
                ) : (
                  followersList.map(f => (
                    <div 
                      key={f.userId} 
                      onClick={() => {
                        handleProfileClick(f.userId, f.displayName);
                        setShowFollowers(false);
                      }}
                      className="flex items-center gap-3 p-3 hover:bg-bg rounded-2xl cursor-pointer group"
                    >
                      <div className="w-12 h-12 rounded-full bg-surface border border-border overflow-hidden">
                        <img 
                          src={f.customPhotoURL || null} 
                          alt="" 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer" 
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm group-hover:text-primary transition-colors">{f.displayName}</span>
                        <span className="text-[10px] text-ink-muted">View Profile</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRequests && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4"
          >
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="w-full max-w-sm bg-surface border border-border rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-border flex justify-between items-center bg-amber-500/5">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <h3 className="font-bold uppercase tracking-widest text-sm">Follow Requests</h3>
                </div>
                <button onClick={() => setShowRequests(false)} className="p-2 hover:bg-bg rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
                {incomingRequests.length === 0 ? (
                  <div className="py-12 text-center text-ink-muted italic opacity-40">All caught up!</div>
                ) : (
                  incomingRequests.map(req => (
                    <div 
                      key={req.fromId} 
                      className="flex items-center justify-between p-4 bg-bg rounded-3xl border border-border"
                    >
                      <div className="flex items-center gap-3 cursor-pointer" onClick={() => { handleProfileClick(req.fromId, req.fromName); setShowRequests(false); }}>
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary italic">
                          {req.fromName[0]}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-xs truncate max-w-[120px]">{req.fromName}</span>
                          <span className="text-[9px] text-ink-muted opacity-60 uppercase tracking-tighter">Requested to follow</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleAcceptRequest(req)}
                          className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center text-bg shadow-lg shadow-primary/20 hover:scale-110 active:scale-95 transition-all"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleRejectRequest(req.fromId)}
                          className="w-8 h-8 bg-surface border border-border rounded-xl flex items-center justify-center text-red-500 hover:bg-red-500/10 active:scale-95 transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showConversations && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-sm bg-surface border border-border rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-border flex justify-between items-center bg-primary/5">
                <span className="text-xs font-bold uppercase tracking-widest text-ink/60">Inbox</span>
                <button onClick={() => setShowConversations(false)} className="text-ink-muted hover:text-ink">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {conversations.length === 0 ? (
                  <div className="p-12 text-center text-xs text-ink-muted italic opacity-40 flex flex-col items-center gap-4">
                    <MessageSquare className="w-10 h-10 opacity-20" />
                    <p>No messages yet</p>
                  </div>
                ) : (
                  conversations.map(conv => {
                    const otherId = conv.participants.find(p => p !== user?.uid);
                    const details = conv.participantDetails?.[otherId || ''];
                    const isUnread = conv.lastSenderId !== user?.uid && !(conv.readBy || []).includes(user?.uid || '');
                    
                    return (
                      <div 
                        key={conv.id} 
                        onClick={() => {
                          setActiveConversation(conv);
                          setShowConversations(false);
                        }}
                        className={`p-4 flex items-center gap-3 hover:bg-bg transition-colors cursor-pointer border-b border-border/50 last:border-0 ${isUnread ? 'bg-primary/5' : ''}`}
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary border border-border overflow-hidden shrink-0">
                          {details?.photo ? (
                            <img src={details.photo} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt="" />
                          ) : (
                            <span>{details?.name?.substring(0, 1).toUpperCase() || 'U'}</span>
                          )}
                        </div>
                        <div className="flex flex-col flex-1 overflow-hidden">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs truncate">{details?.name || 'User'}</span>
                            <span className="text-[9px] text-ink-muted opacity-40">
                              {conv.updatedAt?.toDate ? conv.updatedAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                          <p className={`text-[10px] truncate opacity-60 ${isUnread ? 'text-primary font-medium' : 'text-ink-muted'}`}>
                            {conv.lastMessage || 'Start a conversation'}
                          </p>
                        </div>
                        {isUnread && (
                          <div className="w-2 h-2 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.5)]"></div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeConversation && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 bg-bg flex flex-col"
          >
            {/* Chat Header */}
            <div className="px-6 py-5 border-b border-border flex justify-between items-center bg-bg/80 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <button onClick={() => setActiveConversation(null)} className="p-2 -ml-2 text-ink-muted hover:text-primary transition-colors">
                  <X className="w-6 h-6 rotate-90" />
                </button>
                <div 
                  className="flex items-center gap-3 cursor-pointer group"
                  onClick={() => visitchatProfile(activeConversation)}
                >
                  <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center font-bold text-primary overflow-hidden border border-border">
                    {activeConversation.participantDetails?.[activeConversation.participants.find(p => p !== user?.uid) || '']?.photo ? (
                      <img 
                        src={activeConversation.participantDetails[activeConversation.participants.find(p => p !== user?.uid) || ''].photo} 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer" alt="" 
                      />
                    ) : (
                      <span className="italic">{activeConversation.participantDetails?.[activeConversation.participants.find(p => p !== user?.uid) || '']?.name?.substring(0, 1).toUpperCase() || 'U'}</span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm tracking-tight capitalize group-hover:text-primary transition-colors">
                      {activeConversation.participantDetails?.[activeConversation.participants.find(p => p !== user?.uid) || '']?.name || 'User'}
                    </h3>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      <span className="text-[9px] uppercase font-bold text-ink-muted tracking-widest opacity-60">Online</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide flex flex-col">
               {chatMessages.length === 0 ? (
                 <div className="flex-1 flex flex-col items-center justify-center text-ink-muted opacity-30 space-y-4">
                   <MessageCircle className="w-16 h-16" />
                   <p className="text-sm font-bold uppercase tracking-widest italic">Encrypted Connection Established</p>
                 </div>
               ) : (
                 chatMessages.map((msg, i) => {
                   const isMe = msg.fromId === user?.uid;
                   return (
                     <div 
                       key={msg.id} 
                       className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                     >
                        <div className={`max-w-[75%] space-y-2 ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                          <div className={`px-5 py-3 rounded-3xl text-sm leading-relaxed shadow-sm overflow-hidden ${
                            isMe 
                            ? 'bg-primary text-bg rounded-tr-none' 
                            : 'bg-surface text-ink border border-border rounded-tl-none'
                          }`}>
                            {msg.imageUrl && (
                              <div className="mb-2 -mx-2 -mt-1 rounded-2xl overflow-hidden border border-white/10 bg-black/5">
                                <img 
                                  src={msg.imageUrl} 
                                  alt="Shared photo" 
                                  className="w-full h-auto max-h-[400px] object-contain"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            )}
                            {msg.text && <p>{msg.text}</p>}
                            <div className={`text-[9px] mt-1 opacity-50 ${isMe ? 'text-bg text-right' : 'text-ink-muted'}`}>
                              {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </div>
                          </div>
                        </div>
                     </div>
                   );
                 })
               )}
            </div>

            {/* Message Input */}
            <div className="p-6 bg-surface/50 border-t border-border">
               {chatError && (
                 <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-between">
                   <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider truncate mr-4">
                     {chatError.includes('permission-denied') ? 'Messaging Restricted • Check Privacy' : chatError}
                   </p>
                   <button onClick={() => setChatError(null)} className="text-red-500/50 hover:text-red-500 transition-colors">
                     <X className="w-4 h-4" />
                   </button>
                 </div>
               )}

               {chatImage && (
                 <div className="relative w-24 h-24 mb-4 rounded-2xl overflow-hidden border-2 border-primary/20 shadow-lg group">
                   <img src={chatImage} className="w-full h-full object-cover" alt="Preview" />
                   <button 
                     onClick={() => setChatImage(null)}
                     className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                   >
                     <X className="w-3 h-3" />
                   </button>
                 </div>
               )}

               <div className="flex items-center gap-3 bg-bg border border-border p-2 pr-2 ml-auto rounded-3xl">
                  <label className="p-2 text-ink-muted hover:text-primary cursor-pointer transition-colors shrink-0">
                    {isChatImageUploading ? (
                       <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Camera className="w-5 h-5" />
                    )}
                    <input type="file" className="hidden" accept="image/*" onChange={handleChatImageUpload} disabled={isChatImageUploading} />
                  </label>
                  
                  <input 
                    type="text"
                    placeholder={chatImage ? "Add a caption..." : "Type a message..."}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="flex-1 bg-transparent px-2 py-2 text-sm focus:outline-none placeholder:text-ink-muted/50"
                  />
                  
                  <motion.button 
                    whileTap={{ scale: 0.9 }}
                    onClick={handleSendMessage}
                    disabled={(!newMessage.trim() && !chatImage) || isChatImageUploading || isSendingMessage}
                    className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center text-bg disabled:opacity-30 transition-all shadow-lg shadow-primary/20"
                  >
                    {isSendingMessage ? (
                       <div className="w-5 h-5 border-2 border-bg border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </motion.button>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {isEditingProfile && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/80 backdrop-blur-sm"
          >
            <motion.div 
               initial={{ scale: 0.9, opacity: 0, y: 20 }}
               animate={{ scale: 1, opacity: 1, y: 0 }}
               exit={{ scale: 0.9, opacity: 0, y: 20 }}
               className="w-full max-w-sm bg-surface rounded-[2.5rem] border border-border shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-border flex justify-between items-center bg-primary/5">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-primary" />
                  <h3 className="font-bold uppercase tracking-widest text-sm text-ink">Edit Profile</h3>
                </div>
                <button onClick={() => setIsEditingProfile(false)} className="p-2 hover:bg-bg rounded-full transition-colors text-ink-muted">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleUpdateProfile} className="p-6 space-y-5">
                <div className="flex flex-col items-center mb-4">
                  <div className="relative group">
                    <div className="w-20 h-20 rounded-full border-2 border-primary/20 p-1 overflow-hidden bg-bg ring-2 ring-transparent group-hover:ring-primary/30 transition-all">
                      <img 
                        src={customProfiles[user.uid] || user.photoURL || null} 
                        className={`w-full h-full rounded-full object-cover ${profileLoading ? 'opacity-30' : ''}`}
                        referrerPolicy="no-referrer"
                        alt="" 
                      />
                      {profileLoading && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>
                    <label className="absolute inset-0 cursor-pointer flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                      <Camera className="w-5 h-5 text-white" />
                      <input type="file" className="hidden" accept="image/*" onChange={handleProfilePicUpload} />
                    </label>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-primary mt-2 flex items-center gap-1 leading-none">
                    Change Photo
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-ink-muted tracking-widest ml-1 opacity-50">Full Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full bg-bg border border-border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors text-ink"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-ink-muted tracking-widest ml-1 opacity-50">Username</label>
                  <div className="relative text-ink">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-bold text-sm">@</span>
                    <input
                      type="text"
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value.replace(/\s+/g, '').toLowerCase())}
                      placeholder="username"
                      className="w-full bg-bg border border-border rounded-2xl pl-8 pr-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-ink-muted tracking-widest ml-1 opacity-50">Bio</label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="Tell us about yourself..."
                    rows={3}
                    className="w-full bg-bg border border-border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors text-ink resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-ink-muted tracking-widest ml-1 opacity-50">Bio</label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="Tell us about yourself..."
                    rows={3}
                    className="w-full bg-bg border border-border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors text-ink resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saveLoading}
                  className="w-full bg-primary text-bg font-bold py-4 rounded-2xl shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
                >
                  {saveLoading ? (
                    <div className="w-5 h-5 border-2 border-bg border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
