import { Setting, PluginSettingTab } from "obsidian";
import { getDailyNoteSettings } from "obsidian-daily-notes-interface";

export default class RolloverSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  async getTemplateHeadings() {
    const { template } = getDailyNoteSettings();
    if (!template) return [];

    let file = this.app.vault.getAbstractFileByPath(template);

    if (file === null) {
      file = this.app.vault.getAbstractFileByPath(template + ".md");
    }

    if (file === null) {
      // file not available, no template-heading can be returned
      return [];
    }

    const templateContents = await this.app.vault.read(file);
    const allHeadings = Array.from(templateContents.matchAll(/#{1,} .*/g)).map(
      ([heading]) => heading
    );
    return allHeadings;
  }

  async display() {
    const templateHeadings = await this.getTemplateHeadings();

    this.containerEl.empty();
    new Setting(this.containerEl)
      .setName("Rollover section heading")
      .setDesc(
        "The heading that delimits the rollover section on both yesterday's and today's daily notes. Everything inside this section (sub-headers, todos, notes) is copied to today's note when a new daily note is created, with completed todos and their nested content left behind. Example: '## Rollover'. The section ends at the next heading of equal or higher level; sub-headers inside (e.g. '### asap', '### this week') are preserved. Unfinished todos are merged under matching sub-headers on today's note, or appended as new sub-headers if today doesn't have them yet."
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            ...templateHeadings.reduce((acc, heading) => {
              acc[heading] = heading;
              return acc;
            }, {}),
            none: "None",
          })
          .setValue(this.plugin?.settings.templateHeading)
          .onChange((value) => {
            this.plugin.settings.templateHeading = value;
            this.plugin.saveSettings();
          })
      );

    new Setting(this.containerEl)
      .setName("Delete todos from previous day")
      .setDesc(
        "Removes rolled unfinished todos from yesterday's rollover section after they are copied to today's note. Sub-headers, completed todos, and non-todo text remain on yesterday's note. Enabling this is destructive — use the undo command within 2 minutes if you need to revert."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.deleteOnComplete || false)
          .onChange((value) => {
            this.plugin.settings.deleteOnComplete = value;
            this.plugin.saveSettings();
          })
      );

    new Setting(this.containerEl)
      .setName("Remove empty todos in rollover")
      .setDesc(
        `If you have empty todos, they will not be rolled over to the next day.`
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.removeEmptyTodos || false)
          .onChange((value) => {
            this.plugin.settings.removeEmptyTodos = value;
            this.plugin.saveSettings();
          })
      );

    new Setting(this.containerEl)
      .setName("Roll over children of todos")
      .setDesc(
        `By default, only the actual todos are rolled over. If you add nested Markdown-elements beneath your todos, these are not rolled over but stay in place, possibly altering the logic of your previous note. This setting allows for also migrating the nested elements.`
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.rolloverChildren || false)
          .onChange((value) => {
            this.plugin.settings.rolloverChildren = value;
            this.plugin.saveSettings();
          })
      );

    new Setting(this.containerEl)
      .setName("Automatic rollover on daily note open")
      .setDesc(
        `If enabled, the plugin will automatically rollover todos when you open a daily note.`
      )
      .addToggle((toggle) =>
        toggle
          // Default to true if the setting is not set
          .setValue(
            this.plugin.settings.rolloverOnFileCreate === undefined ||
              this.plugin.settings.rolloverOnFileCreate === null
              ? true
              : this.plugin.settings.rolloverOnFileCreate
          )
          .onChange((value) => {
            console.log(value);
            this.plugin.settings.rolloverOnFileCreate = value;
            this.plugin.saveSettings();
            this.plugin.loadData().then((value) => console.log(value));
          })
      );

    new Setting(this.containerEl)
      .setName("Done status markers")
      .setDesc(
        `Characters that represent done status in checkboxes. Default is "xX-". Add any characters that should be considered as marking a task complete.`
      )
      .addText((text) =>
        text
          .setValue(this.plugin.settings.doneStatusMarkers || "xX-")
          .onChange((value) => {
            this.plugin.settings.doneStatusMarkers = value;
            this.plugin.saveSettings();
          })
      );
    new Setting(this.containerEl)
      .setName("Add blank line before appended content")
      .setDesc(`Inserts a blank line before content appended to each sub-section during rollover. Applies per sub-section body and between today's preamble and yesterday's appended preamble.`)
      .addToggle((toggle) => 
        toggle
          .setValue(
            this.plugin.settings
              .leadingNewLine === undefined || 
              this.plugin.settings.leadingNewLine === null 
              ? true 
              : this.plugin.settings.leadingNewLine
          )
          .onChange((value) => {
            this.plugin.settings.leadingNewLine = value;
            this.plugin.saveSettings();
          })
      );
  }
}
