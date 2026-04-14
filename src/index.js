import { Notice, Plugin } from "obsidian";
import {
  getDailyNoteSettings,
  getAllDailyNotes,
  getDailyNote,
} from "obsidian-daily-notes-interface";
import UndoModal from "./ui/UndoModal";
import RolloverSettingTab from "./ui/RolloverSettingTab";
import { performSectionRollover } from "./rollover-section";

const MAX_TIME_SINCE_CREATION = 5000; // 5 seconds

export default class RolloverTodosPlugin extends Plugin {
  async loadSettings() {
    const DEFAULT_SETTINGS = {
      templateHeading: "none",
      deleteOnComplete: false,
      removeEmptyTodos: false,
      rolloverChildren: false,
      rolloverOnFileCreate: true,
      doneStatusMarkers: "xX-",
      leadingNewLine: true,
    };
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  isDailyNotesEnabled() {
    const dailyNotesPlugin = this.app.internalPlugins.plugins["daily-notes"];
    const dailyNotesEnabled = dailyNotesPlugin && dailyNotesPlugin.enabled;

    const periodicNotesPlugin = this.app.plugins.getPlugin("periodic-notes");
    const periodicNotesEnabled =
      periodicNotesPlugin && periodicNotesPlugin.settings?.daily?.enabled;

    return dailyNotesEnabled || periodicNotesEnabled;
  }

  getLastDailyNote() {
    const { moment } = window;
    let { folder, format } = getDailyNoteSettings();

    folder = this.getCleanFolder(folder);
    folder = folder.length === 0 ? folder : folder + "/";

    const dailyNoteRegexMatch = new RegExp("^" + folder + "(.*).md$");
    const todayMoment = moment();

    // get all notes in directory that aren't null
    const dailyNoteFiles = this.app.vault
      .getMarkdownFiles()
      .filter((file) => file.path.startsWith(folder))
      .filter((file) =>
        moment(
          file.path.replace(dailyNoteRegexMatch, "$1"),
          format,
          true
        ).isValid()
      )
      .filter((file) => file.basename)
      .filter((file) =>
        this.getFileMoment(file, folder, format).isSameOrBefore(
          todayMoment,
          "day"
        )
      );

    // sort by date
    const sorted = dailyNoteFiles.sort(
      (a, b) =>
        this.getFileMoment(b, folder, format).valueOf() -
        this.getFileMoment(a, folder, format).valueOf()
    );
    return sorted[1];
  }

  getFileMoment(file, folder, format) {
    let path = file.path;

    if (path.startsWith(folder)) {
      // Remove length of folder from start of path
      path = path.substring(folder.length);
    }

    if (path.endsWith(`.${file.extension}`)) {
      // Remove length of file extension from end of path
      path = path.substring(0, path.length - file.extension.length - 1);
    }

    return moment(path, format);
  }

  getCleanFolder(folder) {
    // Check if user defined folder with root `/` e.g. `/dailies`
    if (folder.startsWith("/")) {
      folder = folder.substring(1);
    }

    // Check if user defined folder with trailing `/` e.g. `dailies/`
    if (folder.endsWith("/")) {
      folder = folder.substring(0, folder.length - 1);
    }

    return folder;
  }

  async rollover(file = undefined) {
    let { folder, format } = getDailyNoteSettings();
    let ignoreCreationTime = false;

    if (file == undefined) {
      const allDailyNotes = getAllDailyNotes();
      file = getDailyNote(window.moment(), allDailyNotes);
      ignoreCreationTime = true;
    }
    if (!file) return;

    folder = this.getCleanFolder(folder);

    if (!file.path.startsWith(folder)) return;

    const today = new Date();
    const todayFormatted = window.moment(today).format(format);
    const filePathConstructed = `${folder}${
      folder == "" ? "" : "/"
    }${todayFormatted}.${file.extension}`;
    if (filePathConstructed !== file.path) return;

    if (
      today.getTime() - file.stat.ctime > MAX_TIME_SINCE_CREATION &&
      !ignoreCreationTime
    ) {
      return;
    }

    if (!this.isDailyNotesEnabled()) {
      new Notice(
        "RolloverTodosPlugin unable to rollover unfinished todos: Please enable Daily Notes, or Periodic Notes (with daily notes enabled).",
        10000
      );
      return;
    }

    const {
      templateHeading,
      deleteOnComplete,
      removeEmptyTodos,
      rolloverChildren,
      doneStatusMarkers,
      leadingNewLine,
    } = this.settings;

    if (!templateHeading || templateHeading === "none") {
      new Notice(
        "Rollover Daily Todos: set a rollover section heading in plugin settings to enable rollover.",
        8000
      );
      return;
    }

    const lastDailyNote = this.getLastDailyNote();
    if (!lastDailyNote) return;

    const yesterdayContent = await this.app.vault.read(lastDailyNote);
    const todayContent = await this.app.vault.read(file);

    const result = performSectionRollover(
      yesterdayContent,
      todayContent,
      templateHeading,
      {
        doneStatusMarkers,
        rolloverChildren,
        removeEmptyTodos,
        leadingNewLine,
        deleteOnComplete,
      }
    );

    if (result.status === "missing-yesterday") {
      new Notice(
        `Rollover: section heading "${templateHeading}" not found in yesterday's note (${lastDailyNote.basename}). Nothing rolled over.`,
        8000
      );
      return;
    }
    if (result.status === "missing-today") {
      new Notice(
        `Rollover: section heading "${templateHeading}" not found in today's note. Add it to your daily note template to enable rollover.`,
        8000
      );
      return;
    }

    const undoHistoryInstance = {
      previousDay: { file: undefined, oldContent: "" },
      today: { file: undefined, oldContent: "" },
    };

    if (result.newTodayContent !== null && result.newTodayContent !== todayContent) {
      undoHistoryInstance.today = { file, oldContent: todayContent };
      await this.app.vault.modify(file, result.newTodayContent);
    }

    if (result.newYesterdayContent !== null) {
      undoHistoryInstance.previousDay = {
        file: lastDailyNote,
        oldContent: yesterdayContent,
      };
      await this.app.vault.modify(lastDailyNote, result.newYesterdayContent);
    }

    const rolled = result.rolledCount;
    const message =
      rolled === 0
        ? `Rollover ran — no unfinished todos found in "${templateHeading}".`
        : `Rolled over ${rolled} todo${rolled === 1 ? "" : "s"} into "${templateHeading}".`;
    new Notice(message, 4000 + message.length * 3);

    this.undoHistoryTime = new Date();
    this.undoHistory = [undoHistoryInstance];
  }

  async onload() {
    await this.loadSettings();
    this.undoHistory = [];
    this.undoHistoryTime = new Date();

    this.addSettingTab(new RolloverSettingTab(this.app, this));

    this.registerEvent(
      this.app.vault.on("create", async (file) => {
        // Check if automatic daily note creation is enabled
        if (!this.settings.rolloverOnFileCreate) return;
        this.rollover(file);
      })
    );

    this.addCommand({
      id: "obsidian-rollover-daily-todos-rollover",
      name: "Rollover Todos Now",
      callback: () => {
        this.rollover();
      },
    });

    this.addCommand({
      id: "obsidian-rollover-daily-todos-undo",
      name: "Undo last rollover",
      checkCallback: (checking) => {
        // no history, don't allow undo
        if (this.undoHistory.length > 0) {
          const now = window.moment();
          const lastUse = window.moment(this.undoHistoryTime);
          const diff = now.diff(lastUse, "seconds");
          // 2+ mins since use: don't allow undo
          if (diff > 2 * 60) {
            return false;
          }
          if (!checking) {
            new UndoModal(this).open();
          }
          return true;
        }
        return false;
      },
    });
  }
}
