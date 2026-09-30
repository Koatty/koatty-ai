import { Service } from 'koatty_core';
@Service()
export class GreetingService {
  private name = 'Koatty';
  read() {
    return { message: `Hello, ${this.name}!` };
  }
  rename(name: string) {
    this.name = name;
    return this.read();
  }
}
