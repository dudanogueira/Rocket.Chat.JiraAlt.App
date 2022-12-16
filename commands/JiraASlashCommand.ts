import {
  IHttp,
  IModify,
  IRead,
} from "@rocket.chat/apps-engine/definition/accessors";
import { IApp } from "@rocket.chat/apps-engine/definition/IApp";
import { IRoom, RoomType } from "@rocket.chat/apps-engine/definition/rooms";
import {
  ISlashCommand,
  SlashCommandContext,
} from "@rocket.chat/apps-engine/definition/slashcommands";
import { IUser } from "@rocket.chat/apps-engine/definition/users";
import { AppSetting } from "../config/Settings";
const adf2md = require("adf-to-md");

export class JiraAltCommand implements ISlashCommand {
  app: IApp;

  constructor(app) {
    this.app = app;
  }
  public command = "jiraa"; // here is where you define the command name,
  // users will need to run /phone to trigger this command
  public i18nParamsExample = "JiraAlt_Params";
  public i18nDescription = "JiraAlt_Description";
  public providesPreview = false;

  public async executor(
    context: SlashCommandContext,
    read: IRead,
    modify: IModify,
    http: IHttp
  ): Promise<void> {
    // let's discover if we have a subcommand
    const [subcommand] = context.getArguments();
    read.getUserReader();
    // lets define a deult help message
    const you_can_run =
      "You can run:\n" +
      "`/jiraa ISSUE-ID` to display an issue\n" +
      "`/jiraa [help]` to get help";

    if (subcommand == "help") {
      this.sendNotification(context, modify, you_can_run);
      return;
    }

    if (subcommand) {
      // get informations from settings
      const { value: JiraAltToken } = await read
        .getEnvironmentReader()
        .getSettings()
        .getById(AppSetting.JiraAltToken);
      const { value: JiraAltUrl } = await read
        .getEnvironmentReader()
        .getSettings()
        .getById(AppSetting.JiraAltUrl);

      const url = JiraAltUrl + "/rest/api/3/issue/" + subcommand;
      const base64_auth = Buffer.from(JiraAltToken).toString("base64");
      var issue = await http.get(url, {
        headers: { Authorization: "Basic " + base64_auth },
        //query: "fields=summary,comment",
      });
      if (issue.statusCode == 404) {
        this.sendNotification(
          context,
          modify,
          `Issue \`${subcommand}\` not found.`
        );
        return;
      }
      if (issue.statusCode == 200) {
        const content = issue.data;
        // issue url
        const issue_url = `${JiraAltUrl}/browse/${content.key}`;

        const messageStructure = modify.getCreator().startMessage();
        const sender = context.getSender(); // get the sender from context
        const room = context.getRoom(); // get the rom from context

        messageStructure.setRoom(room); //.setText(message); // set the text message

        const assignee = content.fields.assignee?.displayName || "Unnassigned";
        const avatarUrl = content.fields.project.avatarUrls["48x48"];

        messageStructure.addAttachment({
          title: {
            value: "Open",
            link: issue_url,
          },
          //text: content.fields.description.content,//adf2md(content.fields.description.content),
          text: "Issue Description here!",
          collapsed: false,
          author: {
            link: issue_url,
            name: `${content.key}: ${content.fields.summary}`,
            icon: avatarUrl,
          },
          color: content.fields.status.statusCategory.colorName,
          fields: [
            {
              short: true,
              title: "Status",
              value: `\`${content.fields.status.name}\``,
            },
            {
              short: true,
              title: "Priority",
              value: `\`${content.fields.priority.name}\``,
            },
            {
              short: true,
              title: "Type",
              value: `\`${content.fields.issuetype.name}\``,
            },
            { short: true, title: "Assignee", value: `\`${assignee}\`` },
          ],
        });

        await modify.getCreator().finish(messageStructure); // sends the message in the room.
      }
    } else {
      // no comand, show help
      this.sendNotification(context, modify, you_can_run);
    }
  }

  private async sendMessage(
    context: SlashCommandContext,
    modify: IModify,
    message: string
  ): Promise<void> {
    const messageStructure = modify.getCreator().startMessage();
    const sender = context.getSender(); // get the sender from context
    const room = context.getRoom(); // get the rom from context

    messageStructure.setSender(sender).setRoom(room).setText(message); // set the text message

    messageStructure.addAttachment;

    await modify.getCreator().finish(messageStructure); // sends the message in the room.
  }

  private async sendNotification(
    context: SlashCommandContext,
    modify: IModify,
    message: string
  ): Promise<void> {
    const sender = context.getSender(); // get the sender from context
    const room = context.getRoom(); // get the rom from context
    var messageStructure = modify.getCreator().startMessage().setRoom(room);
    // uncomment bellow if you want the notification to be sent by the sender
    // instead of the app bot user
    // messageStructure = messageStructure.setSender(sender)

    // lets build a really simple block (more on that on other Commands)
    const block = modify.getCreator().getBlockBuilder();
    // we want this block to have a Text supporting MarkDown
    block.addSectionBlock({
      text: block.newMarkdownTextObject(message),
    });

    // now let's set the blocks in our message
    messageStructure.setBlocks(block);
    // and finally, notify the user with the IMessage
    await modify
      .getNotifier()
      .notifyUser(sender, messageStructure.getMessage());
  }

  private async getOrCreateDirectRoom(
    read: IRead,
    modify: IModify,
    usernames: Array<string>,
    creator?: IUser
  ) {
    let room;
    // first, let's try to get the direct room for given usernames
    try {
      room = await read.getRoomReader().getDirectByUsernames(usernames);
    } catch (error) {
      this.app.getLogger().log(error);
      return;
    }
    // nice, room exist already, lets return it.
    if (room) {
      return room;
    } else {
      // no room for the given users. Lets create a room now!
      // for flexibility, we might allow different creators
      // if no creator, use app user bot
      if (!creator) {
        creator = await read.getUserReader().getAppUser();
        if (!creator) {
          throw new Error("Error while getting AppUser");
        }
      }

      let roomId: string;
      // Create direct room
      const newRoom = modify
        .getCreator()
        .startRoom()
        .setType(RoomType.DIRECT_MESSAGE)
        .setCreator(creator)
        .setMembersToBeAddedByUsernames(usernames);
      roomId = await modify.getCreator().finish(newRoom);
      return await read.getRoomReader().getById(roomId);
    }
  }

  private async sendDirect(
    context: SlashCommandContext,
    read: IRead,
    modify: IModify,
    message: string
  ): Promise<void> {
    const messageStructure = modify.getCreator().startMessage();
    const sender = context.getSender(); // get the sender from context
    // get the appUser username
    const appUser = await read.getUserReader().getAppUser();
    if (!appUser) {
      throw new Error("Something went wrong getting App User!");
    }
    // lets use a function we created to get or create direct room
    let room = (await this.getOrCreateDirectRoom(read, modify, [
      sender.username,
      appUser.username,
    ])) as IRoom;
    messageStructure.setRoom(room).setText(message); // set the text message
    await modify.getCreator().finish(messageStructure); // sends the message in the room.
  }
}
