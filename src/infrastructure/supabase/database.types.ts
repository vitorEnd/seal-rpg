export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      campaign_chapters: {
        Row: {
          background_image_storage_key: string | null
          background_image_url: string | null
          campaign_id: string
          completed_at: string | null
          created_at: string
          description: string
          id: string
          short_description: string
          slug: string
          sort_order: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          background_image_storage_key?: string | null
          background_image_url?: string | null
          campaign_id: string
          completed_at?: string | null
          created_at?: string
          description: string
          id?: string
          short_description: string
          slug: string
          sort_order: number
          status: string
          title: string
          updated_at?: string
        }
        Update: {
          background_image_storage_key?: string | null
          background_image_url?: string | null
          campaign_id?: string
          completed_at?: string | null
          created_at?: string
          description?: string
          id?: string
          short_description?: string
          slug?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_chapters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_events: {
        Row: {
          campaign_id: string
          created_at: string
          description: string
          id: string
          image_url: string | null
          occurred_at: string
          sort_order: number
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          occurred_at: string
          sort_order: number
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          occurred_at?: string
          sort_order?: number
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_members: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          joined_at: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          joined_at?: string
          role: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          joined_at?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_sessions: {
        Row: {
          campaign_id: string
          consequences: string
          created_at: string
          description: string
          events: string
          id: string
          occurred_at: string | null
          scheduled_at: string | null
          session_number: number
          status: string
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          consequences?: string
          created_at?: string
          description?: string
          events?: string
          id?: string
          occurred_at?: string | null
          scheduled_at?: string | null
          session_number: number
          status: string
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          consequences?: string
          created_at?: string
          description?: string
          events?: string
          id?: string
          occurred_at?: string | null
          scheduled_at?: string | null
          session_number?: number
          status?: string
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_sessions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          background_image_storage_key: string | null
          background_image_url: string | null
          cover_image_storage_key: string | null
          cover_image_url: string | null
          created_at: string
          description: string
          game_master_user_id: string | null
          genre: string
          id: string
          name: string
          primary_color: string
          secondary_color: string
          setting: string
          short_description: string
          slug: string
          start_date: string | null
          status: string
          story_summary: string
          updated_at: string
        }
        Insert: {
          background_image_storage_key?: string | null
          background_image_url?: string | null
          cover_image_storage_key?: string | null
          cover_image_url?: string | null
          created_at?: string
          description: string
          game_master_user_id?: string | null
          genre: string
          id?: string
          name: string
          primary_color: string
          secondary_color: string
          setting: string
          short_description: string
          slug: string
          start_date?: string | null
          status: string
          story_summary?: string
          updated_at?: string
        }
        Update: {
          background_image_storage_key?: string | null
          background_image_url?: string | null
          cover_image_storage_key?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string
          game_master_user_id?: string | null
          genre?: string
          id?: string
          name?: string
          primary_color?: string
          secondary_color?: string
          setting?: string
          short_description?: string
          slug?: string
          start_date?: string | null
          status?: string
          story_summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_game_master_user_id_fkey"
            columns: ["game_master_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chapter_transitions: {
        Row: {
          campaign_id: string
          created_at: string
          from_chapter_id: string
          id: string
          map_id: string | null
          occurred_at: string
          table_id: string
          to_chapter_id: string | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          from_chapter_id: string
          id?: string
          map_id?: string | null
          occurred_at?: string
          table_id: string
          to_chapter_id?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          from_chapter_id?: string
          id?: string
          map_id?: string | null
          occurred_at?: string
          table_id?: string
          to_chapter_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_transitions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_transitions_from_chapter_campaign_fkey"
            columns: ["from_chapter_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_chapters"
            referencedColumns: ["id", "campaign_id"]
          },
          {
            foreignKeyName: "chapter_transitions_map_campaign_fkey"
            columns: ["map_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "virtual_table_maps"
            referencedColumns: ["id", "campaign_id"]
          },
          {
            foreignKeyName: "chapter_transitions_table_campaign_fkey"
            columns: ["table_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "virtual_tables"
            referencedColumns: ["id", "campaign_id"]
          },
          {
            foreignKeyName: "chapter_transitions_to_chapter_campaign_fkey"
            columns: ["to_chapter_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_chapters"
            referencedColumns: ["id", "campaign_id"]
          },
        ]
      }
      character_class_options: {
        Row: {
          active: boolean
          bonus_agility: number
          bonus_control: number
          bonus_marksmanship: number
          bonus_perception: number
          bonus_physical: number
          bonus_technique: number
          campaign_id: string
          created_at: string
          description: string
          id: string
          logo_image_storage_key: string | null
          logo_image_url: string | null
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          bonus_agility?: number
          bonus_control?: number
          bonus_marksmanship?: number
          bonus_perception?: number
          bonus_physical?: number
          bonus_technique?: number
          campaign_id: string
          created_at?: string
          description?: string
          id?: string
          logo_image_storage_key?: string | null
          logo_image_url?: string | null
          name: string
          slug: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          bonus_agility?: number
          bonus_control?: number
          bonus_marksmanship?: number
          bonus_perception?: number
          bonus_physical?: number
          bonus_technique?: number
          campaign_id?: string
          created_at?: string
          description?: string
          id?: string
          logo_image_storage_key?: string | null
          logo_image_url?: string | null
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_class_options_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      character_status_options: {
        Row: {
          active: boolean
          campaign_id: string
          color: string
          created_at: string
          id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          campaign_id: string
          color: string
          created_at?: string
          id?: string
          name: string
          slug: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          campaign_id?: string
          color?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_status_options_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          attribute_agility: number
          attribute_control: number
          attribute_marksmanship: number
          attribute_perception: number
          attribute_physical: number
          attribute_technique: number
          background_image_storage_key: string | null
          background_image_url: string | null
          backpack_items: string[]
          campaign_id: string
          class_option_id: string
          cover_image_storage_key: string | null
          cover_image_url: string | null
          created_at: string
          description: string
          equipment: string[]
          gender: string
          id: string
          inventory_slots: number
          name: string
          primary_color: string
          secondary_color: string
          short_description: string
          slug: string
          start_date: string | null
          status_option_id: string
          updated_at: string
          user_id: string
          wounds: string[]
        }
        Insert: {
          attribute_agility: number
          attribute_control: number
          attribute_marksmanship: number
          attribute_perception: number
          attribute_physical: number
          attribute_technique: number
          background_image_storage_key?: string | null
          background_image_url?: string | null
          backpack_items?: string[]
          campaign_id: string
          class_option_id: string
          cover_image_storage_key?: string | null
          cover_image_url?: string | null
          created_at?: string
          description: string
          equipment?: string[]
          gender: string
          id?: string
          inventory_slots?: number
          name: string
          primary_color: string
          secondary_color: string
          short_description: string
          slug: string
          start_date?: string | null
          status_option_id: string
          updated_at?: string
          user_id: string
          wounds?: string[]
        }
        Update: {
          attribute_agility?: number
          attribute_control?: number
          attribute_marksmanship?: number
          attribute_perception?: number
          attribute_physical?: number
          attribute_technique?: number
          background_image_storage_key?: string | null
          background_image_url?: string | null
          backpack_items?: string[]
          campaign_id?: string
          class_option_id?: string
          cover_image_storage_key?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string
          equipment?: string[]
          gender?: string
          id?: string
          inventory_slots?: number
          name?: string
          primary_color?: string
          secondary_color?: string
          short_description?: string
          slug?: string
          start_date?: string | null
          status_option_id?: string
          updated_at?: string
          user_id?: string
          wounds?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "characters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "characters_class_option_campaign_fkey"
            columns: ["class_option_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "character_class_options"
            referencedColumns: ["id", "campaign_id"]
          },
          {
            foreignKeyName: "characters_status_option_campaign_fkey"
            columns: ["status_option_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "character_status_options"
            referencedColumns: ["id", "campaign_id"]
          },
          {
            foreignKeyName: "characters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dice_rolls: {
        Row: {
          actor_name: string
          campaign_id: string
          created_at: string
          dice_values: number[]
          expression: string
          id: string
          modifier: number
          session_id: string
          table_id: string
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          actor_name: string
          campaign_id: string
          created_at?: string
          dice_values: number[]
          expression: string
          id?: string
          modifier: number
          session_id: string
          table_id: string
          total: number
          updated_at?: string
          user_id: string
        }
        Update: {
          actor_name?: string
          campaign_id?: string
          created_at?: string
          dice_values?: number[]
          expression?: string
          id?: string
          modifier?: number
          session_id?: string
          table_id?: string
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dice_rolls_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dice_rolls_table_campaign_session_fkey"
            columns: ["table_id", "campaign_id", "session_id"]
            isOneToOne: false
            referencedRelation: "virtual_tables"
            referencedColumns: ["id", "campaign_id", "session_id"]
          },
          {
            foreignKeyName: "dice_rolls_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      file_relations: {
        Row: {
          campaign_id: string
          created_at: string
          file_id: string
          id: string
          relation_id: string
          relation_type: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          file_id: string
          id?: string
          relation_id: string
          relation_type: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          file_id?: string
          id?: string
          relation_id?: string
          relation_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_relations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_relations_file_campaign_fkey"
            columns: ["file_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "game_files"
            referencedColumns: ["id", "campaign_id"]
          },
        ]
      }
      game_files: {
        Row: {
          campaign_id: string
          category: string
          created_at: string
          created_by_user_id: string | null
          description: string
          id: string
          mime_type: string | null
          name: string
          size_bytes: number | null
          storage_key: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          campaign_id: string
          category: string
          created_at?: string
          created_by_user_id?: string | null
          description?: string
          id?: string
          mime_type?: string | null
          name: string
          size_bytes?: number | null
          storage_key?: string | null
          updated_at?: string
          visibility: string
        }
        Update: {
          campaign_id?: string
          category?: string
          created_at?: string
          created_by_user_id?: string | null
          description?: string
          id?: string
          mime_type?: string | null
          name?: string
          size_bytes?: number | null
          storage_key?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_files_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_files_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_participants: {
        Row: {
          campaign_id: string
          character_id: string
          created_at: string
          id: string
          mission_id: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          character_id: string
          created_at?: string
          id?: string
          mission_id: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          character_id?: string
          created_at?: string
          id?: string
          mission_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_participants_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_participants_character_campaign_fkey"
            columns: ["character_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id", "campaign_id"]
          },
          {
            foreignKeyName: "mission_participants_mission_campaign_fkey"
            columns: ["mission_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id", "campaign_id"]
          },
        ]
      }
      missions: {
        Row: {
          briefing: string
          campaign_id: string
          created_at: string
          description: string
          id: string
          image_url: string | null
          mission_number: number
          name: string
          notes: string
          primary_objective: string
          result: string
          scheduled_at: string | null
          secondary_objectives: string[]
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          briefing?: string
          campaign_id: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          mission_number: number
          name: string
          notes?: string
          primary_objective?: string
          result?: string
          scheduled_at?: string | null
          secondary_objectives?: string[]
          sort_order: number
          status: string
          updated_at?: string
        }
        Update: {
          briefing?: string
          campaign_id?: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          mission_number?: number
          name?: string
          notes?: string
          primary_objective?: string
          result?: string
          scheduled_at?: string | null
          secondary_objectives?: string[]
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "missions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          name: string
          role: string
          status: string
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          name: string
          role?: string
          status?: string
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: string
          status?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      session_participants: {
        Row: {
          campaign_id: string
          character_id: string
          created_at: string
          id: string
          session_id: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          character_id: string
          created_at?: string
          id?: string
          session_id: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          character_id?: string
          created_at?: string
          id?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_participants_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participants_character_campaign_fkey"
            columns: ["character_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id", "campaign_id"]
          },
          {
            foreignKeyName: "session_participants_session_campaign_fkey"
            columns: ["session_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_sessions"
            referencedColumns: ["id", "campaign_id"]
          },
        ]
      }
      team_members: {
        Row: {
          campaign_id: string
          character_id: string
          created_at: string
          id: string
          sort_order: number
          team_id: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          character_id: string
          created_at?: string
          id?: string
          sort_order?: number
          team_id: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          character_id?: string
          created_at?: string
          id?: string
          sort_order?: number
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_character_campaign_fkey"
            columns: ["character_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id", "campaign_id"]
          },
          {
            foreignKeyName: "team_members_team_campaign_fkey"
            columns: ["team_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id", "campaign_id"]
          },
        ]
      }
      teams: {
        Row: {
          campaign_id: string
          created_at: string
          description: string
          id: string
          image_url: string | null
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          name: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      virtual_table_maps: {
        Row: {
          built_in: boolean
          built_in_image_url: string | null
          campaign_id: string
          created_at: string
          created_by_user_id: string | null
          description: string
          group_name: string
          id: string
          image_file_id: string | null
          layer_name: string
          name: string
          scale: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          built_in?: boolean
          built_in_image_url?: string | null
          campaign_id: string
          created_at?: string
          created_by_user_id?: string | null
          description?: string
          group_name: string
          id?: string
          image_file_id?: string | null
          layer_name: string
          name: string
          scale: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          built_in?: boolean
          built_in_image_url?: string | null
          campaign_id?: string
          created_at?: string
          created_by_user_id?: string | null
          description?: string
          group_name?: string
          id?: string
          image_file_id?: string | null
          layer_name?: string
          name?: string
          scale?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "virtual_table_maps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "virtual_table_maps_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "virtual_table_maps_image_file_campaign_fkey"
            columns: ["image_file_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "game_files"
            referencedColumns: ["id", "campaign_id"]
          },
        ]
      }
      virtual_table_tokens: {
        Row: {
          accent_color: string
          campaign_id: string
          character_id: string | null
          collectible: boolean
          created_at: string
          disposition: string
          id: string
          image_file_id: string | null
          kind: string
          map_id: string | null
          name: string
          notes: string
          rotation: number
          size: number
          table_id: string
          updated_at: string
          visible: boolean
          vision_angle: number
          vision_color: string
          vision_enabled: boolean
          vision_range: number
          x: number
          y: number
          z_index: number
        }
        Insert: {
          accent_color: string
          campaign_id: string
          character_id?: string | null
          collectible?: boolean
          created_at?: string
          disposition: string
          id?: string
          image_file_id?: string | null
          kind: string
          map_id?: string | null
          name: string
          notes?: string
          rotation?: number
          size: number
          table_id: string
          updated_at?: string
          visible?: boolean
          vision_angle?: number
          vision_color: string
          vision_enabled?: boolean
          vision_range?: number
          x: number
          y: number
          z_index?: number
        }
        Update: {
          accent_color?: string
          campaign_id?: string
          character_id?: string | null
          collectible?: boolean
          created_at?: string
          disposition?: string
          id?: string
          image_file_id?: string | null
          kind?: string
          map_id?: string | null
          name?: string
          notes?: string
          rotation?: number
          size?: number
          table_id?: string
          updated_at?: string
          visible?: boolean
          vision_angle?: number
          vision_color?: string
          vision_enabled?: boolean
          vision_range?: number
          x?: number
          y?: number
          z_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "virtual_table_tokens_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "virtual_table_tokens_character_campaign_fkey"
            columns: ["character_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id", "campaign_id"]
          },
          {
            foreignKeyName: "virtual_table_tokens_image_file_campaign_fkey"
            columns: ["image_file_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "game_files"
            referencedColumns: ["id", "campaign_id"]
          },
          {
            foreignKeyName: "virtual_table_tokens_map_campaign_fkey"
            columns: ["map_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "virtual_table_maps"
            referencedColumns: ["id", "campaign_id"]
          },
          {
            foreignKeyName: "virtual_table_tokens_table_campaign_fkey"
            columns: ["table_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "virtual_tables"
            referencedColumns: ["id", "campaign_id"]
          },
        ]
      }
      virtual_tables: {
        Row: {
          active_map_id: string | null
          campaign_id: string
          closed_at: string | null
          created_at: string
          id: string
          map_file_id: string | null
          opened_at: string
          opened_by_user_id: string
          revision: number
          session_id: string
          status: string
          updated_at: string
        }
        Insert: {
          active_map_id?: string | null
          campaign_id: string
          closed_at?: string | null
          created_at?: string
          id?: string
          map_file_id?: string | null
          opened_at?: string
          opened_by_user_id: string
          revision?: number
          session_id: string
          status: string
          updated_at?: string
        }
        Update: {
          active_map_id?: string | null
          campaign_id?: string
          closed_at?: string | null
          created_at?: string
          id?: string
          map_file_id?: string | null
          opened_at?: string
          opened_by_user_id?: string
          revision?: number
          session_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "virtual_tables_active_map_campaign_fkey"
            columns: ["active_map_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "virtual_table_maps"
            referencedColumns: ["id", "campaign_id"]
          },
          {
            foreignKeyName: "virtual_tables_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "virtual_tables_map_file_campaign_fkey"
            columns: ["map_file_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "game_files"
            referencedColumns: ["id", "campaign_id"]
          },
          {
            foreignKeyName: "virtual_tables_opened_by_user_id_fkey"
            columns: ["opened_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "virtual_tables_session_campaign_fkey"
            columns: ["session_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_sessions"
            referencedColumns: ["id", "campaign_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_virtual_table_map: {
        Args: { target_map_id: string; target_table_id: string }
        Returns: Json
      }
      admin_list_profiles: {
        Args: never
        Returns: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          name: string
          role: string
          status: string
          updated_at: string
          username: string
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_update_campaign_session_and_close_table: {
        Args: {
          new_consequences: string
          new_description: string
          new_events: string
          new_occurred_at: string
          new_scheduled_at: string
          new_session_number: number
          new_status: string
          new_summary: string
          new_title: string
          target_campaign_id: string
          target_session_id: string
        }
        Returns: Json
      }
      admin_update_profile_access: {
        Args: {
          target_profile_id: string
          target_role: string
          target_status: string
        }
        Returns: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          name: string
          role: string
          status: string
          updated_at: string
          username: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      advance_virtual_table_chapter: {
        Args: {
          expected_current_chapter_id: string
          expected_next_chapter_id: string
          target_map_id: string
          target_table_id: string
        }
        Returns: Json
      }
      broadcast_virtual_table_token_preview: {
        Args: {
          target_table_id: string
          target_token_id: string
          target_x: number
          target_y: number
        }
        Returns: boolean
      }
      close_virtual_table: { Args: { target_table_id: string }; Returns: Json }
      rollback_virtual_table_chapter: {
        Args: {
          expected_current_chapter_id: string | null
          expected_previous_chapter_id: string
          target_table_id: string
        }
        Returns: Json
      }
      delete_virtual_table_map: {
        Args: { target_map_id: string }
        Returns: Json
      }
      get_campaign_chapter_timeline: {
        Args: { target_campaign_id: string }
        Returns: {
          background_image_storage_key: string
          background_image_url: string
          chapter_id: string
          chapter_position: number
          completed_at: string
          created_at: string
          description: string
          is_locked: boolean
          short_description: string
          slug: string
          sort_order: number
          state: string
          title: string
          updated_at: string
        }[]
      }
      get_current_profile: {
        Args: never
        Returns: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          name: string
          role: string
          status: string
          updated_at: string
          username: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      list_campaign_profiles: {
        Args: { target_campaign_id: string }
        Returns: {
          avatar_url: string
          id: string
          name: string
          role: string
          status: string
          username: string
        }[]
      }
      list_public_campaign_cards: {
        Args: never
        Returns: {
          background_image_url: string
          cover_image_url: string
          genre: string
          id: string
          name: string
          player_count: number
          primary_color: string
          secondary_color: string
          short_description: string
          slug: string
          status: string
          updated_at: string
        }[]
      }
      move_virtual_table_token: {
        Args: {
          target_table_id: string
          target_token_id: string
          target_x: number
          target_y: number
        }
        Returns: Json
      }
      open_virtual_table: {
        Args: { target_campaign_id: string; target_session_id: string }
        Returns: Json
      }
      request_campaign_membership: {
        Args: { target_campaign_id: string }
        Returns: {
          campaign_id: string
          created_at: string
          id: string
          joined_at: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "campaign_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      roll_virtual_table_dice: {
        Args: { requested_expression: string; target_table_id: string }
        Returns: Json
      }
      set_virtual_table_map_file: {
        Args: { target_map_file_id: string; target_table_id: string }
        Returns: Json
      }
      update_character_loadout: {
        Args: {
          new_backpack_items: string[]
          new_equipment: string[]
          new_inventory_slots: number
          new_wounds: string[]
          target_character_id: string
        }
        Returns: {
          attribute_agility: number
          attribute_control: number
          attribute_marksmanship: number
          attribute_perception: number
          attribute_physical: number
          attribute_technique: number
          background_image_storage_key: string | null
          background_image_url: string | null
          backpack_items: string[]
          campaign_id: string
          class_option_id: string
          cover_image_storage_key: string | null
          cover_image_url: string | null
          created_at: string
          description: string
          equipment: string[]
          gender: string
          id: string
          inventory_slots: number
          name: string
          primary_color: string
          secondary_color: string
          short_description: string
          slug: string
          start_date: string | null
          status_option_id: string
          updated_at: string
          user_id: string
          wounds: string[]
        }
        SetofOptions: {
          from: "*"
          to: "characters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
