/**
 * Supported resource view names.
 */
export type ViewName = 'list' | 'create' | 'edit' | 'detail';

/**
 * Legacy/simple per-view visibility map.
 * Prefer `FieldMeta.views` for richer view-level configuration.
 */
export type ViewVisibility = Partial<Record<ViewName, boolean>>;

/**
 * Runtime data passed to field-level render functions.
 */
export type FieldRenderContext = {
	/**
	 * Field key in the resource schema.
	 */
	key: string;
	/**
	 * Current field value for the active row/item.
	 */
	value: unknown;
	/**
	 * Current row/item object.
	 */
	row: Record<string, unknown>;
};

/**
 * Custom renderer signature for a field in a specific view.
 */
export type FieldRenderer = (ctx: FieldRenderContext) => unknown;

/**
 * Per-view override for field behavior and presentation.
 * Values here override the global `FieldMeta` values for a specific view.
 */
export type FieldViewConfig = {
	/**
	 * Hide this field in the given view.
	 */
	hidden?: boolean;

	/**
	 * Override field label for the view.
	 */
	label?: string;

	/**
	 * Override placeholder text for the view.
	 */
	placeholder?: string;

	/**
	 * Override help/description text for the view.
	 */
	description?: string;

	/**
	 * Override read-only state for the view.
	 */
	readOnly?: boolean;

	/**
	 * Override ordering for the view (lower first).
	 */
	order?: number;

	/**
	 * Custom renderer for the view.
	 */
	render?: FieldRenderer;
};

/**
 * Map of per-view field overrides.
 */
export type FieldViews = Partial<Record<ViewName, FieldViewConfig>>;

/**
 * Source metadata declared via `defineField`.
 * These values are global defaults and can be overridden by `views.<view>`.
 */
export type FieldMeta = {
	/**
	 * Display label for the field.
	 */
	label?: string;

	/**
	 * Placeholder text for form inputs.
	 */
	placeholder?: string;

	/**
	 * Helper/description text shown near the field.
	 */
	description?: string;

	/**
	 * Hide this field from all views.
	 */
	hidden?: boolean;

	/**
	 * Mark field as read-only by default.
	 */
	readOnly?: boolean;

	/**
	 * Per-view overrides.
	 */
	views?: FieldViews;

	/**
	 * Global ordering fallback (lower first).
	 */
	order?: number;
};

/**
 * Fully resolved field metadata for rendering/use in a specific context.
 * Includes inferred defaults and computed required/read-only/hidden state.
 */
export type ResolvedField = Required<Pick<FieldMeta, 'label' | 'hidden' | 'readOnly' | 'order'>> &
	Omit<FieldMeta, 'label' | 'hidden' | 'readOnly' | 'order'> & {
		/**
		 * Schema key for the field.
		 */
		key: string;

		/**
		 * Whether the underlying zod field is required.
		 */
		required: boolean;

		/**
		 * Optional effective renderer for the active view.
		 */
		render?: FieldRenderer;
	};
