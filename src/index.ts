// Import necessary methods from azle
import {
  $init,
  $query,
  $update,
  Record,
  StableBTreeMap,
  Vec,
  match,
  Result,
  nat64,
  ic,
  Opt,
  nat,
  nat8,
  Principal,
} from 'azle';

// Define a Record to store all the details about the task
type Task = Record<{
  title: string; // Title of the task
  description: string; // A brief description of the task
  assignedTo: string; // The team member to whom it is assigned
  isDone: boolean; // To track whether the task has been completed
  startTime: nat64; // The time at which the task started
  deadline: nat; // Deadline in hours
}>;

// Define a Record to store the user input for the task
type TaskLoad = Record<{
  title: string;
  description: string;
  assignedTo: string;
  deadline: nat;
}>;

// Replace this with your principal from the terminal or the Internet Identity
// Admin principal ID in a string format
var adminPrincipal: string = '2vxsx-fae';

// Store team members
let memberCount: nat8 = 0;
const memberStore = new StableBTreeMap<nat8, Principal>(0, 100, 1000);

// Store tasks
let taskCount: nat8 = 0;
const taskStore = new StableBTreeMap<nat8, Task>(1, 100, 1000);

// Set the contract deployer as the admin
$init;
export function init(admin: string): void {
  adminPrincipal = admin;
}

// Return the one who deployed the contract
$query;
export function contractOwner(): Principal {
  return Principal.fromText(adminPrincipal);
}

// Add a new team member by the admin
$update;
export function addMember(principalID: Principal): Result<nat8, string> {
  if (ic.caller().toString() !== adminPrincipal) {
    return Result.Err('You are not authorized to add new members');
  }
  memberCount = memberCount + 1;
  memberStore.insert(memberCount, principalID);
  return Result.Ok(memberCount);
}

// Delete a team member by the admin
$update;
export function deleteMember(id: nat8): Result<string, string> {
  if (ic.caller().toString() !== adminPrincipal) {
    return Result.Err('You are not authorized to delete members');
  }

  const removedMember = memberStore.remove(id);
  if (removedMember === null) {
    return Result.Err('Member not found');
  }

  return Result.Ok('Member has been deleted');
}

// Get a team member by ID
$query;
export function getMember(id: nat8): Result<Principal, string> {
  const member = memberStore.get(id);
  if (member === null) {
    return Result.Err('Member does not exist');
  }
  return Result.Ok(member);
}

// Update the principal of the team member by the admin
$update;
export function updateMember(id: nat8, newName: string): Result<nat8, string> {
  if (ic.caller().toString() !== adminPrincipal) {
    return Result.Err('You are not authorized to update members');
  }

  if (newName.length === 0) {
    return Result.Err('New principal cannot be empty');
  }

  const principalID = Principal.fromText(newName);
  memberStore.insert(id, principalID);
  return Result.Ok(id);
}

// Get all team members
$query;
export function getAllMembers(): Result<Vec<Principal>, string> {
  const members = memberStore.values();
  if (members.length === 0) {
    return Result.Err('No family members yet');
  }
  return Result.Ok(members);
}

// Get all tasks stored in the contract
$query;
export function getAllTasks(): Result<Vec<Task>, string> {
  const tasks = taskStore.values();
  if (tasks.length === 0) {
    return Result.Err('No tasks yet');
  }
  return Result.Ok(tasks);
}

// Get a specific task by its ID
$query;
export function getTask(id: nat8): Result<Task, string> {
  const task = taskStore.get(id);
  if (task === null) {
    return Result.Err('No task found with that ID');
  }
  return Result.Ok(task);
}

// Delete a task by the admin using its ID
$update;
export function deleteTask(id: nat8): Result<string, string> {
  if (ic.caller().toString() !== adminPrincipal) {
    return Result.Err('You are not authorized to delete tasks');
  }

  const removedTask = taskStore.remove(id);
  if (removedTask === null) {
    return Result.Err('No task found with that ID');
  }

  return Result.Ok('Task deleted');
}

// Check if the principal ID is among the team members
$query;
export function isMember(principal: string): boolean {
  const principalID = Principal.fromText(principal);
  return memberStore.values().some((member) => member.isEqual(principalID));
}

// Return the tasks for a specific team member based on the condition (isDone)
$query;
export function personalTasks(principal: string, condition: boolean): Vec<Task> {
  const tasks = taskStore.values();
  return tasks.filter((task) => task.assignedTo === principal && task.isDone === condition);
}

// Calculate and convert hours to nanoseconds
const hoursToNanoseconds = (hours: nat): nat64 => {
  const nanosecondsPerHour = 60n * 60n * 1_000_000_000n;
  return nat64.fromBigInt(hours * nanosecondsPerHour);
};

// Search for tasks by the title or description
$query;
export function searchTasks(query: string): Result<Vec<Task>, string> {
  const matchingTasks = taskStore.values().filter((task) => {
    const inTitle = task.title.toLowerCase().includes(query.toLowerCase());
    const inDescription = task.description.toLowerCase().includes(query.toLowerCase());
    return inTitle || inDescription;
  });

  return Result.Ok(matchingTasks);
}

// Add a task by the admin and assign it to a team member
$update;
export function addTask(payload: TaskLoad): Result<nat8, string> {
  if (ic.caller().toString() !== adminPrincipal) {
    return Result.Err('Only admins can add tasks');
  }

  const principalID = Principal.fromText(payload.assignedTo);
  if (!isMember(payload.assignedTo)) {
    return Result.Err('Assigned member does not exist');
  }

  if (payload.title.length === 0 || payload.description.length === 0 || payload.deadline < 1) {
    return Result.Err('Malformed values');
  }

  const newTask: Task = {
    title: payload.title,
    description: payload.description,
    assignedTo: payload.assignedTo,
    isDone: false,
    startTime: ic.time(),
    deadline: payload.deadline,
  };

  taskCount = taskCount + 1;
  taskStore.insert(taskCount, newTask);
  return Result.Ok(taskCount);
}

// Complete a task by the member
$update;
export function completeTask(id
