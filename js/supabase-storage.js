// 确保只定义一次
if (typeof window.SupabaseStorage === 'undefined') {
  (function() {
    // 使用统一配置
    let SUPABASE_URL = 'https://uujlzxidillcvqjxmqnj.supabase.co';
    let SUPABASE_KEY = 'sb_publishable_x0Do8yWb3XA5Asr1x0Bd7Q_HfDMgIl6';
    let STORAGE_BUCKET = 'documents';

    let supabase = null;
    let initAttempts = 0;
    const maxInitAttempts = 10;

    // 等待配置加载
    function waitForConfig() {
      return new Promise((resolve) => {
        const checkConfig = () => {
          if (window.SupabaseConfig) {
            SUPABASE_URL = window.SupabaseConfig.URL;
            SUPABASE_KEY = window.SupabaseConfig.API_KEY;
            STORAGE_BUCKET = window.SupabaseConfig.STORAGE_BUCKET || 'documents';
            resolve();
          } else if (initAttempts < maxInitAttempts) {
            initAttempts++;
            setTimeout(checkConfig, 200);
          } else {
            console.warn('⚠️ SupabaseConfig not found, using default values');
            resolve();
          }
        };
        checkConfig();
      });
    }

    async function initSupabase() {
      try {
        // 等待配置加载
        await waitForConfig();

        if (typeof window !== 'undefined') {
          if (window.supabase && typeof window.supabase.createClient === 'function') {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
              auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true
              }
            });
            
            // 测试连接
            await testConnection();
            
          } else if (typeof window.createClient === 'function') {
            supabase = window.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log('✅ Supabase client initialized with window.createClient');
          } else {
            console.error('❌ Supabase SDK not loaded - waiting 500ms...');
            setTimeout(initSupabase, 500);
          }
        }
      } catch (e) {
        console.error('❌ Error initializing Supabase:', e);
        if (initAttempts < maxInitAttempts) {
          setTimeout(initSupabase, 1000);
        }
      }
    }

    // 测试 Supabase 连接
    async function testConnection() {
      try {
        // 测试认证
        const { data: sessionData } = await supabase.auth.getSession();
        console.log('🔐 Auth session status:', sessionData.session ? '已登录' : '未登录');

        // 测试存储
        try {
          const { data: storageData, error: storageError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .list('', { limit: 1 });
          if (storageError) {
            console.warn('⚠️ Storage bucket "' + STORAGE_BUCKET + '" not found or access denied');
            console.warn('   请在 Supabase 中创建名为 "' + STORAGE_BUCKET + '" 的存储桶');
          } else {
            console.log('📁 Storage bucket "' + STORAGE_BUCKET + '" accessible');
          }
        } catch (storageErr) {
          console.warn('⚠️ Storage test failed:', storageErr.message);
        }

        console.log('✅ Supabase client initialized successfully');
        console.log('🔗 URL:', SUPABASE_URL);
        console.log('📦 Bucket:', STORAGE_BUCKET);
        
      } catch (err) {
        console.warn('⚠️ Connection test failed:', err.message);
      }
    }

    // 立即初始化
    initSupabase();

    const SupabaseStorage = {
      async uploadFile(file, folder = 'orders', onProgress = null) {
        if (!supabase) {
          console.error('❌ Supabase client not initialized');
          return { success: false, error: 'Supabase client not initialized' };
        }

        try {
          const timestamp = Date.now();
          const random = Math.random().toString(36).substring(2, 8);
          const fileExt = file.name.split('.').pop();
          const fileName = `${timestamp}_${random}.${fileExt}`;
          
          let cleanFolder = folder.replace(/^\/|\/$/g, '');
          const filePath = cleanFolder ? `${cleanFolder}/${fileName}` : fileName;

          console.log(`📤 Uploading file: ${file.name} to bucket: documents, path: ${filePath}`);

          const { data: sessionData } = await supabase.auth.getSession();
          const ownerId = sessionData.session?.user?.id || 'anonymous';

          const { data, error } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false,
              metadata: { owner_id: ownerId },
              onUploadProgress: (progress) => {
                if (onProgress) {
                  const percent = (progress.loaded / progress.total) * 100;
                  onProgress(percent);
                }
              }
            });

          if (error) {
            console.error('❌ Upload error:', error);
            throw error;
          }

          const { data: urlData } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(filePath);

          console.log('✅ Upload successful:', urlData.publicUrl);

          return {
            success: true,
            filePath,
            publicUrl: urlData.publicUrl,
            fileName: file.name,
            fileSize: file.size
          };
        } catch (error) {
          console.error('❌ File upload failed:', error);
          return {
            success: false,
            error: error.message || 'Unknown error'
          };
        }
      },

      async deleteFile(filePath) {
        if (!supabase) {
          return { success: false, error: 'Supabase client not initialized' };
        }

        try {
          const { error } = await supabase.storage
            .from(STORAGE_BUCKET)
            .remove([filePath]);

          if (error) throw error;
          return { success: true };
        } catch (error) {
          console.error('❌ File delete failed:', error);
          return {
            success: false,
            error: error.message
          };
        }
      },

      async listFiles(folder = '') {
        if (!supabase) {
          return { success: false, error: 'Supabase client not initialized', files: [] };
        }

        try {
          const { data, error } = await supabase.storage
            .from(STORAGE_BUCKET)
            .list(folder);

          if (error) throw error;
          return { success: true, files: data };
        } catch (error) {
          console.error('❌ List files failed:', error);
          return { success: false, error: error.message, files: [] };
        }
      },

      async downloadFile(filePath) {
        if (!supabase) {
          return { success: false, error: 'Supabase client not initialized' };
        }

        try {
          const { data, error } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(filePath);

          if (error) throw error;
          return { success: true, url: data.publicUrl };
        } catch (error) {
          console.error('❌ Download file failed:', error);
          return { success: false, error: error.message };
        }
      },

      async checkAuth() {
        if (!supabase) {
          return { authenticated: false, error: 'Supabase client not initialized' };
        }

        try {
          const { data, error } = await supabase.auth.getSession();
          if (error) {
            console.error('❌ Auth check error:', error);
            return { authenticated: false, error: error.message };
          }
          return { authenticated: !!data.session, session: data.session };
        } catch (error) {
          return { authenticated: false, error: error.message };
        }
      },

      async signIn(email, password) {
        if (!supabase) {
          return { success: false, error: 'Supabase client not initialized' };
        }

        try {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          return { success: true, data };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },

      async signUp(email, password, name) {
        if (!supabase) {
          return { success: false, error: 'Supabase client not initialized' };
        }

        try {
          const { data, error } = await supabase.auth.signUp({ email, password });
          if (error) throw error;

          if (data.user) {
            try {
              // 检查是否是第一个注册用户
              const { data: countData, error: countError } = await supabase
                .from('users')
                .select('id', { count: 'exact', head: true });
              
              // 第一个用户自动成为超级管理员，之后的用户默认是跟单员
              const role = (countData === 0 || countError) ? 'super_admin' : 'follow_up_staff';
              
              await supabase.from('users').insert([{
                id: data.user.id,
                email,
                name,
                role
              }]);
              
              console.log(`✅ 用户注册成功，角色: ${role}`);
            } catch (userError) {
              console.warn('⚠️ Users table insert failed:', userError.message);
            }
          }

          return { success: true, data };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },

      isReady() {
        return supabase !== null;
      }
    };

    // 挂载到全局
    window.SupabaseStorage = SupabaseStorage;
    window.getFileIcon = function(fileType) {
      const icons = {
        'qc': 'fa-camera',
        'customs': 'fa-file-alt',
        'invoice': 'fa-file-invoice',
        'mark': 'fa-image',
        'default': 'fa-file'
      };
      return icons[fileType] || icons['default'];
    };

    window.formatFileSize = function(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    window.formatDate = function(dateString) {
      const date = new Date(dateString);
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    console.log('✅ SupabaseStorage loaded successfully');
  })();
} else {
  console.log('⚠️ SupabaseStorage already defined, skipping');
}