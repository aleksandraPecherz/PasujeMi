// Check-only provider returning a fixed text, to prove that is-json rejects it. config.output overrides the text.
export default class TextProvider {
  private readonly output: string;
  private readonly providerId: string;

  constructor(options: { id?: string; config?: { output?: string } } = {}) {
    this.output = options.config?.output ?? "this is not json";
    this.providerId = options.id ?? "text-provider";
  }

  id(): string {
    return this.providerId;
  }

  async callApi(): Promise<{ output: string }> {
    return { output: this.output };
  }
}
