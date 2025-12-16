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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      canjes_codigo: {
        Row: {
          codigo_id: string
          descuento_aplicado: number | null
          fecha_canje: string | null
          id: string
          maquina_id: string
          monto_original: number | null
        }
        Insert: {
          codigo_id: string
          descuento_aplicado?: number | null
          fecha_canje?: string | null
          id?: string
          maquina_id: string
          monto_original?: number | null
        }
        Update: {
          codigo_id?: string
          descuento_aplicado?: number | null
          fecha_canje?: string | null
          id?: string
          maquina_id?: string
          monto_original?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "canjes_codigo_codigo_id_fkey"
            columns: ["codigo_id"]
            isOneToOne: false
            referencedRelation: "codigos_promocionales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canjes_codigo_maquina_id_fkey"
            columns: ["maquina_id"]
            isOneToOne: false
            referencedRelation: "maquinas"
            referencedColumns: ["id"]
          },
        ]
      }
      codigos_promocionales: {
        Row: {
          codigo: string
          created_at: string | null
          estado: string
          fecha_expiracion: string
          fecha_inicio: string
          id: string
          maquinas: Json | null
          nombre: string
          tipo_descuento: string
          usos_actuales: number | null
          usos_maximos: number | null
          usuario_id: string
          valor_descuento: number
        }
        Insert: {
          codigo: string
          created_at?: string | null
          estado?: string
          fecha_expiracion: string
          fecha_inicio: string
          id?: string
          maquinas?: Json | null
          nombre: string
          tipo_descuento: string
          usos_actuales?: number | null
          usos_maximos?: number | null
          usuario_id: string
          valor_descuento: number
        }
        Update: {
          codigo?: string
          created_at?: string | null
          estado?: string
          fecha_expiracion?: string
          fecha_inicio?: string
          id?: string
          maquinas?: Json | null
          nombre?: string
          tipo_descuento?: string
          usos_actuales?: number | null
          usos_maximos?: number | null
          usuario_id?: string
          valor_descuento?: number
        }
        Relationships: []
      }
      dispositivos_usuario: {
        Row: {
          activo: boolean | null
          created_at: string | null
          id: string
          plataforma: string
          token_push: string
          updated_at: string | null
          usuario_id: string
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          id?: string
          plataforma: string
          token_push: string
          updated_at?: string | null
          usuario_id: string
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          id?: string
          plataforma?: string
          token_push?: string
          updated_at?: string | null
          usuario_id?: string
        }
        Relationships: []
      }
      incidencia_mensajes: {
        Row: {
          autor: string
          created_at: string | null
          id: string
          incidencia_id: string
          mensaje: string
        }
        Insert: {
          autor: string
          created_at?: string | null
          id?: string
          incidencia_id: string
          mensaje: string
        }
        Update: {
          autor?: string
          created_at?: string | null
          id?: string
          incidencia_id?: string
          mensaje?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidencia_mensajes_incidencia_id_fkey"
            columns: ["incidencia_id"]
            isOneToOne: false
            referencedRelation: "incidencias"
            referencedColumns: ["id"]
          },
        ]
      }
      incidencias: {
        Row: {
          created_at: string | null
          descripcion: string
          estado: string
          fotos: Json | null
          id: string
          maquina_id: string
          numero_ticket: string
          prioridad: string
          resolucion: string | null
          tipo: string
          updated_at: string | null
          usuario_id: string
        }
        Insert: {
          created_at?: string | null
          descripcion: string
          estado?: string
          fotos?: Json | null
          id?: string
          maquina_id: string
          numero_ticket: string
          prioridad?: string
          resolucion?: string | null
          tipo: string
          updated_at?: string | null
          usuario_id: string
        }
        Update: {
          created_at?: string | null
          descripcion?: string
          estado?: string
          fotos?: Json | null
          id?: string
          maquina_id?: string
          numero_ticket?: string
          prioridad?: string
          resolucion?: string | null
          tipo?: string
          updated_at?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidencias_maquina_id_fkey"
            columns: ["maquina_id"]
            isOneToOne: false
            referencedRelation: "maquinas"
            referencedColumns: ["id"]
          },
        ]
      }
      maquinas: {
        Row: {
          activa: boolean | null
          created_at: string | null
          id: string
          mac_address: string
          nombre_personalizado: string
          ubicacion: string | null
          usuario_id: string
        }
        Insert: {
          activa?: boolean | null
          created_at?: string | null
          id?: string
          mac_address: string
          nombre_personalizado: string
          ubicacion?: string | null
          usuario_id: string
        }
        Update: {
          activa?: boolean | null
          created_at?: string | null
          id?: string
          mac_address?: string
          nombre_personalizado?: string
          ubicacion?: string | null
          usuario_id?: string
        }
        Relationships: []
      }
      mensajes_soporte: {
        Row: {
          autor: string
          created_at: string | null
          id: string
          mensaje: string
          usuario_id: string
        }
        Insert: {
          autor: string
          created_at?: string | null
          id?: string
          mensaje: string
          usuario_id: string
        }
        Update: {
          autor?: string
          created_at?: string | null
          id?: string
          mensaje?: string
          usuario_id?: string
        }
        Relationships: []
      }
      metodos_pago: {
        Row: {
          created_at: string | null
          id: string
          nombre: string
          predeterminado: boolean | null
          tipo: string
          ultimos_digitos: string | null
          usuario_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nombre: string
          predeterminado?: boolean | null
          tipo: string
          ultimos_digitos?: string | null
          usuario_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nombre?: string
          predeterminado?: boolean | null
          tipo?: string
          ultimos_digitos?: string | null
          usuario_id?: string
        }
        Relationships: []
      }
      notificaciones: {
        Row: {
          created_at: string | null
          datos: Json | null
          enviada: boolean | null
          fecha_envio: string | null
          id: string
          leida: boolean | null
          mensaje: string
          tipo: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          created_at?: string | null
          datos?: Json | null
          enviada?: boolean | null
          fecha_envio?: string | null
          id?: string
          leida?: boolean | null
          mensaje: string
          tipo: string
          titulo: string
          usuario_id: string
        }
        Update: {
          created_at?: string | null
          datos?: Json | null
          enviada?: boolean | null
          fecha_envio?: string | null
          id?: string
          leida?: boolean | null
          mensaje?: string
          tipo?: string
          titulo?: string
          usuario_id?: string
        }
        Relationships: []
      }
      pagos_suscripcion: {
        Row: {
          estado: string
          factura_url: string | null
          fecha_pago: string | null
          id: string
          monto: number
          suscripcion_id: string
        }
        Insert: {
          estado?: string
          factura_url?: string | null
          fecha_pago?: string | null
          id?: string
          monto: number
          suscripcion_id: string
        }
        Update: {
          estado?: string
          factura_url?: string | null
          fecha_pago?: string | null
          id?: string
          monto?: number
          suscripcion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagos_suscripcion_suscripcion_id_fkey"
            columns: ["suscripcion_id"]
            isOneToOne: false
            referencedRelation: "suscripciones"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_items: {
        Row: {
          cantidad: number
          id: string
          pedido_id: string
          precio_unitario: number
          producto_id: string
          subtotal: number
        }
        Insert: {
          cantidad?: number
          id?: string
          pedido_id: string
          precio_unitario: number
          producto_id: string
          subtotal: number
        }
        Update: {
          cantidad?: number
          id?: string
          pedido_id?: string
          precio_unitario?: number
          producto_id?: string
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_items_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_items_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          created_at: string | null
          direccion_envio: string | null
          envio: number
          estado: string
          id: string
          metodo_pago: string | null
          numero_pedido: string
          subtotal: number
          total: number
          updated_at: string | null
          usuario_id: string
        }
        Insert: {
          created_at?: string | null
          direccion_envio?: string | null
          envio?: number
          estado?: string
          id?: string
          metodo_pago?: string | null
          numero_pedido: string
          subtotal?: number
          total?: number
          updated_at?: string | null
          usuario_id: string
        }
        Update: {
          created_at?: string | null
          direccion_envio?: string | null
          envio?: number
          estado?: string
          id?: string
          metodo_pago?: string | null
          numero_pedido?: string
          subtotal?: number
          total?: number
          updated_at?: string | null
          usuario_id?: string
        }
        Relationships: []
      }
      preferencias_notificaciones: {
        Row: {
          canal_email: boolean | null
          canal_push: boolean | null
          id: string
          incidencias: boolean | null
          nuevas_ventas: boolean | null
          pedidos: boolean | null
          promociones: boolean | null
          stock_bajo: boolean | null
          temperatura_alerta: boolean | null
          umbral_stock: number | null
          updated_at: string | null
          usuario_id: string
        }
        Insert: {
          canal_email?: boolean | null
          canal_push?: boolean | null
          id?: string
          incidencias?: boolean | null
          nuevas_ventas?: boolean | null
          pedidos?: boolean | null
          promociones?: boolean | null
          stock_bajo?: boolean | null
          temperatura_alerta?: boolean | null
          umbral_stock?: number | null
          updated_at?: string | null
          usuario_id: string
        }
        Update: {
          canal_email?: boolean | null
          canal_push?: boolean | null
          id?: string
          incidencias?: boolean | null
          nuevas_ventas?: boolean | null
          pedidos?: boolean | null
          promociones?: boolean | null
          stock_bajo?: boolean | null
          temperatura_alerta?: boolean | null
          umbral_stock?: number | null
          updated_at?: string | null
          usuario_id?: string
        }
        Relationships: []
      }
      productos: {
        Row: {
          activo: boolean | null
          categoria: string
          created_at: string | null
          descripcion: string | null
          id: string
          imagen_url: string | null
          nombre: string
          precio: number
          stock_disponible: number | null
        }
        Insert: {
          activo?: boolean | null
          categoria: string
          created_at?: string | null
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          nombre: string
          precio: number
          stock_disponible?: number | null
        }
        Update: {
          activo?: boolean | null
          categoria?: string
          created_at?: string | null
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          nombre?: string
          precio?: number
          stock_disponible?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          direccion: string | null
          email: string
          foto_url: string | null
          id: string
          intereses: Json | null
          nif_cif: string | null
          nombre: string
          nombre_empresa: string | null
          notificaciones: Json | null
          telefono: string | null
        }
        Insert: {
          created_at?: string | null
          direccion?: string | null
          email: string
          foto_url?: string | null
          id: string
          intereses?: Json | null
          nif_cif?: string | null
          nombre: string
          nombre_empresa?: string | null
          notificaciones?: Json | null
          telefono?: string | null
        }
        Update: {
          created_at?: string | null
          direccion?: string | null
          email?: string
          foto_url?: string | null
          id?: string
          intereses?: Json | null
          nif_cif?: string | null
          nombre?: string
          nombre_empresa?: string | null
          notificaciones?: Json | null
          telefono?: string | null
        }
        Relationships: []
      }
      suscripciones: {
        Row: {
          created_at: string | null
          estado: string
          fecha_inicio: string
          fecha_renovacion: string | null
          id: string
          metodo_pago_id: string | null
          plan: string
          precio_mensual: number
          usuario_id: string
        }
        Insert: {
          created_at?: string | null
          estado?: string
          fecha_inicio?: string
          fecha_renovacion?: string | null
          id?: string
          metodo_pago_id?: string | null
          plan: string
          precio_mensual?: number
          usuario_id: string
        }
        Update: {
          created_at?: string | null
          estado?: string
          fecha_inicio?: string
          fecha_renovacion?: string | null
          id?: string
          metodo_pago_id?: string | null
          plan?: string
          precio_mensual?: number
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suscripciones_metodo_pago_id_fkey"
            columns: ["metodo_pago_id"]
            isOneToOne: false
            referencedRelation: "metodos_pago"
            referencedColumns: ["id"]
          },
        ]
      }
      video_tutoriales: {
        Row: {
          activo: boolean | null
          categoria: string
          created_at: string | null
          descripcion: string | null
          duracion: string | null
          id: string
          orden: number | null
          thumbnail_url: string | null
          titulo: string
          video_url: string | null
        }
        Insert: {
          activo?: boolean | null
          categoria: string
          created_at?: string | null
          descripcion?: string | null
          duracion?: string | null
          id?: string
          orden?: number | null
          thumbnail_url?: string | null
          titulo: string
          video_url?: string | null
        }
        Update: {
          activo?: boolean | null
          categoria?: string
          created_at?: string | null
          descripcion?: string | null
          duracion?: string | null
          id?: string
          orden?: number | null
          thumbnail_url?: string | null
          titulo?: string
          video_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_order_number: { Args: never; Returns: string }
      generate_ticket_number: { Args: never; Returns: string }
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
