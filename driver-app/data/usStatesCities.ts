// US States and Cities Data
// This file contains a comprehensive list of US states with their major cities

export interface State {
  name: string;
  abbreviation: string;
  cities: string[];
}

export const US_STATES_CITIES: State[] = [
  {
    name: 'Alabama',
    abbreviation: 'AL',
    cities: ['Birmingham', 'Montgomery', 'Mobile', 'Huntsville', 'Tuscaloosa'],
  },
  {
    name: 'Alaska',
    abbreviation: 'AK',
    cities: ['Anchorage', 'Fairbanks', 'Juneau', 'Sitka', 'Ketchikan'],
  },
  {
    name: 'Arizona',
    abbreviation: 'AZ',
    cities: ['Phoenix', 'Tucson', 'Mesa', 'Chandler', 'Scottsdale', 'Glendale', 'Tempe'],
  },
  {
    name: 'Arkansas',
    abbreviation: 'AR',
    cities: ['Little Rock', 'Fort Smith', 'Fayetteville', 'Springdale', 'Jonesboro'],
  },
  {
    name: 'California',
    abbreviation: 'CA',
    cities: [
      'Los Angeles',
      'San Diego',
      'San Jose',
      'San Francisco',
      'Fresno',
      'Sacramento',
      'Long Beach',
      'Oakland',
      'Bakersfield',
      'Anaheim',
      'Santa Ana',
      'Riverside',
      'Stockton',
      'Irvine',
      'Chula Vista',
    ],
  },
  {
    name: 'Colorado',
    abbreviation: 'CO',
    cities: ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Lakewood', 'Thornton'],
  },
  {
    name: 'Connecticut',
    abbreviation: 'CT',
    cities: ['Bridgeport', 'New Haven', 'Hartford', 'Stamford', 'Waterbury', 'Norwalk'],
  },
  {
    name: 'Delaware',
    abbreviation: 'DE',
    cities: ['Wilmington', 'Dover', 'Newark', 'Middletown', 'Smyrna'],
  },
  {
    name: 'Florida',
    abbreviation: 'FL',
    cities: [
      'Jacksonville',
      'Miami',
      'Tampa',
      'Orlando',
      'St. Petersburg',
      'Hialeah',
      'Tallahassee',
      'Fort Lauderdale',
      'Port St. Lucie',
      'Cape Coral',
    ],
  },
  {
    name: 'Georgia',
    abbreviation: 'GA',
    cities: ['Atlanta', 'Augusta', 'Columbus', 'Savannah', 'Athens', 'Sandy Springs'],
  },
  {
    name: 'Hawaii',
    abbreviation: 'HI',
    cities: ['Honolulu', 'Hilo', 'Kailua', 'Kaneohe', 'Pearl City'],
  },
  {
    name: 'Idaho',
    abbreviation: 'ID',
    cities: ['Boise', 'Nampa', 'Meridian', 'Idaho Falls', 'Pocatello'],
  },
  {
    name: 'Illinois',
    abbreviation: 'IL',
    cities: [
      'Chicago',
      'Aurora',
      'Rockford',
      'Joliet',
      'Naperville',
      'Springfield',
      'Peoria',
      'Elgin',
    ],
  },
  {
    name: 'Indiana',
    abbreviation: 'IN',
    cities: ['Indianapolis', 'Fort Wayne', 'Evansville', 'South Bend', 'Carmel', 'Fishers'],
  },
  {
    name: 'Iowa',
    abbreviation: 'IA',
    cities: ['Des Moines', 'Cedar Rapids', 'Davenport', 'Sioux City', 'Iowa City'],
  },
  {
    name: 'Kansas',
    abbreviation: 'KS',
    cities: ['Wichita', 'Overland Park', 'Kansas City', 'Olathe', 'Topeka'],
  },
  {
    name: 'Kentucky',
    abbreviation: 'KY',
    cities: ['Louisville', 'Lexington', 'Bowling Green', 'Owensboro', 'Covington'],
  },
  {
    name: 'Louisiana',
    abbreviation: 'LA',
    cities: ['New Orleans', 'Baton Rouge', 'Shreveport', 'Lafayette', 'Lake Charles'],
  },
  {
    name: 'Maine',
    abbreviation: 'ME',
    cities: ['Portland', 'Lewiston', 'Bangor', 'South Portland', 'Auburn'],
  },
  {
    name: 'Maryland',
    abbreviation: 'MD',
    cities: ['Baltimore', 'Frederick', 'Rockville', 'Gaithersburg', 'Bowie'],
  },
  {
    name: 'Massachusetts',
    abbreviation: 'MA',
    cities: ['Boston', 'Worcester', 'Springfield', 'Lowell', 'Cambridge', 'New Bedford'],
  },
  {
    name: 'Michigan',
    abbreviation: 'MI',
    cities: ['Detroit', 'Grand Rapids', 'Warren', 'Sterling Heights', 'Lansing', 'Ann Arbor'],
  },
  {
    name: 'Minnesota',
    abbreviation: 'MN',
    cities: ['Minneapolis', 'St. Paul', 'Rochester', 'Duluth', 'Bloomington'],
  },
  {
    name: 'Mississippi',
    abbreviation: 'MS',
    cities: ['Jackson', 'Gulfport', 'Southaven', 'Hattiesburg', 'Biloxi'],
  },
  {
    name: 'Missouri',
    abbreviation: 'MO',
    cities: ['Kansas City', 'St. Louis', 'Springfield', 'Columbia', 'Independence'],
  },
  {
    name: 'Montana',
    abbreviation: 'MT',
    cities: ['Billings', 'Missoula', 'Great Falls', 'Bozeman', 'Butte'],
  },
  {
    name: 'Nebraska',
    abbreviation: 'NE',
    cities: ['Omaha', 'Lincoln', 'Bellevue', 'Grand Island', 'Kearney'],
  },
  {
    name: 'Nevada',
    abbreviation: 'NV',
    cities: ['Las Vegas', 'Henderson', 'Reno', 'North Las Vegas', 'Sparks'],
  },
  {
    name: 'New Hampshire',
    abbreviation: 'NH',
    cities: ['Manchester', 'Nashua', 'Concord', 'Derry', 'Rochester'],
  },
  {
    name: 'New Jersey',
    abbreviation: 'NJ',
    cities: ['Newark', 'Jersey City', 'Paterson', 'Elizabeth', 'Edison', 'Woodbridge'],
  },
  {
    name: 'New Mexico',
    abbreviation: 'NM',
    cities: ['Albuquerque', 'Las Cruces', 'Rio Rancho', 'Santa Fe', 'Roswell'],
  },
  {
    name: 'New York',
    abbreviation: 'NY',
    cities: [
      'New York City',
      'Buffalo',
      'Rochester',
      'Yonkers',
      'Syracuse',
      'Albany',
      'New Rochelle',
    ],
  },
  {
    name: 'North Carolina',
    abbreviation: 'NC',
    cities: ['Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem', 'Fayetteville'],
  },
  {
    name: 'North Dakota',
    abbreviation: 'ND',
    cities: ['Fargo', 'Bismarck', 'Grand Forks', 'Minot', 'West Fargo'],
  },
  {
    name: 'Ohio',
    abbreviation: 'OH',
    cities: ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron', 'Dayton'],
  },
  {
    name: 'Oklahoma',
    abbreviation: 'OK',
    cities: ['Oklahoma City', 'Tulsa', 'Norman', 'Broken Arrow', 'Lawton'],
  },
  {
    name: 'Oregon',
    abbreviation: 'OR',
    cities: ['Portland', 'Eugene', 'Salem', 'Gresham', 'Hillsboro'],
  },
  {
    name: 'Pennsylvania',
    abbreviation: 'PA',
    cities: ['Philadelphia', 'Pittsburgh', 'Allentown', 'Erie', 'Reading', 'Scranton'],
  },
  {
    name: 'Rhode Island',
    abbreviation: 'RI',
    cities: ['Providence', 'Warwick', 'Cranston', 'Pawtucket', 'East Providence'],
  },
  {
    name: 'South Carolina',
    abbreviation: 'SC',
    cities: ['Charleston', 'Columbia', 'North Charleston', 'Mount Pleasant', 'Rock Hill'],
  },
  {
    name: 'South Dakota',
    abbreviation: 'SD',
    cities: ['Sioux Falls', 'Rapid City', 'Aberdeen', 'Brookings', 'Watertown'],
  },
  {
    name: 'Tennessee',
    abbreviation: 'TN',
    cities: ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Clarksville'],
  },
  {
    name: 'Texas',
    abbreviation: 'TX',
    cities: [
      'Houston',
      'San Antonio',
      'Dallas',
      'Austin',
      'Fort Worth',
      'El Paso',
      'Arlington',
      'Corpus Christi',
      'Plano',
      'Laredo',
    ],
  },
  {
    name: 'Utah',
    abbreviation: 'UT',
    cities: ['Salt Lake City', 'West Valley City', 'Provo', 'West Jordan', 'Orem'],
  },
  {
    name: 'Vermont',
    abbreviation: 'VT',
    cities: ['Burlington', 'Essex', 'South Burlington', 'Colchester', 'Montpelier'],
  },
  {
    name: 'Virginia',
    abbreviation: 'VA',
    cities: ['Virginia Beach', 'Norfolk', 'Richmond', 'Newport News', 'Alexandria'],
  },
  {
    name: 'Washington',
    abbreviation: 'WA',
    cities: ['Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue', 'Kent'],
  },
  {
    name: 'West Virginia',
    abbreviation: 'WV',
    cities: ['Charleston', 'Huntington', 'Parkersburg', 'Morgantown', 'Wheeling'],
  },
  {
    name: 'Wisconsin',
    abbreviation: 'WI',
    cities: ['Milwaukee', 'Madison', 'Green Bay', 'Kenosha', 'Racine'],
  },
  {
    name: 'Wyoming',
    abbreviation: 'WY',
    cities: ['Cheyenne', 'Casper', 'Laramie', 'Gillette', 'Rock Springs'],
  },
];

// Helper function to get cities by state name
export const getCitiesByState = (stateName: string): string[] => {
  const state = US_STATES_CITIES.find(
    (s) => s.name.toLowerCase() === stateName.toLowerCase()
  );
  return state ? state.cities : [];
};

// Helper function to get all state names
export const getStateNames = (): string[] => {
  return US_STATES_CITIES.map((state) => state.name);
};

