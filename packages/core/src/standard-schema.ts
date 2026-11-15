// The Standard Schema interface (https://standardschema.dev), the part of it the core uses. The
// spec asks libraries to copy it rather than depend on a package; Kit's `form()` takes any
// schema of this shape.

/** A schema any Standard Schema consumer can validate with. */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
	readonly '~standard': StandardSchemaV1.Props<Input, Output>;
}

// eslint-disable-next-line @typescript-eslint/no-namespace -- the spec's own shape
export declare namespace StandardSchemaV1 {
	export interface Props<Input = unknown, Output = Input> {
		readonly version: 1;
		readonly vendor: string;
		readonly validate: (value: unknown) => Result<Output> | Promise<Result<Output>>;
		readonly types?: { readonly input: Input; readonly output: Output } | undefined;
	}

	export type Result<Output> = SuccessResult<Output> | FailureResult;

	export interface SuccessResult<Output> {
		readonly value: Output;
		readonly issues?: undefined;
	}

	export interface FailureResult {
		readonly issues: ReadonlyArray<Issue>;
	}

	export interface Issue {
		readonly message: string;
		readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
	}

	export interface PathSegment {
		readonly key: PropertyKey;
	}
}
