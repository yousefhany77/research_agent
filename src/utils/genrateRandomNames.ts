const firstNames = [
  'Alice',
  'Bob',
  'Charlie',
  'David',
  'Eve',
  'Fiona',
  'George',
  'Henry',
  'Isabella',
  'Jack',
  'Kevin',
  'Laura',
  'Michael',
  'Noah',
  'Olivia',
  'Peter',
];
const lastNames = [
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Miller',
  'Davis',
  ' Garcia',
  ' Rodriguez',
  ' Wilson',
  ' Moore',
  ' Taylor',
  ' Anderson',
  '  Thomas',
  '  Jackson',
  '  Evans',
  '  Young',
  '  Walker',
];

// Generate a random name
//not worth installing a library for this
export function generateName(prefix?: string): string {
  // Define lists of first and last names

  // Generate random indexes for first and last names
  const firstNameIndex = Math.floor(Math.random() * firstNames.length);
  const lastNameIndex = Math.floor(Math.random() * lastNames.length);

  return `${prefix ? `${prefix} ` : ''}${firstNames[firstNameIndex]} ${lastNames[lastNameIndex]}`;
}
