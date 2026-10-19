// City views: per-port architecture, the line on the port's sign, and where the quay
// sits in that port's painting (quay = the y position, 0..1 from the top, where building
// bases stand; measured from each generated image). harbor = which end the harbor office and pier go.
TW.CITY = {
  havana:       { style: 'spanish', quay: 0.73, harbor: 'right', blurb: 'Key to the New World' },
  merida:       { style: 'spanish', quay: 0.69, harbor: 'left',  blurb: 'White city of the Yucatán' },
  belize:       { style: 'english', quay: 0.72, harbor: 'right', blurb: 'Logwood camp on the mangroves' },
  trujillo:     { style: 'spanish', quay: 0.71, harbor: 'left',  blurb: 'Fortress of the Mosquito Coast' },
  sanjuan:      { style: 'spanish', quay: 0.65, harbor: 'right', blurb: 'Gateway to the great lake' },
  portobelo:    { style: 'spanish', quay: 0.67, harbor: 'left',  blurb: 'Where the silver fleets gather' },
  cartagena:    { style: 'spanish', quay: 0.72, harbor: 'right', blurb: 'The walled jewel of the Main' },
  caracas:      { style: 'spanish', quay: 0.72, harbor: 'left',  blurb: 'Port of La Guaira, below the mountain' },
  curacao:      { style: 'english', quay: 0.71, harbor: 'right', blurb: 'Dutch trading post, open to all' },
  barbados:     { style: 'english', quay: 0.67, harbor: 'left',  blurb: 'Bridgetown, sugar and spires' },
  martinique:   { style: 'english', quay: 0.71, harbor: 'right', blurb: 'Pearl of the French Antilles' },
  guadeloupe:   { style: 'english', quay: 0.67, harbor: 'left',  blurb: 'Basse-Terre, beneath the volcano' },
  antigua:      { style: 'english', quay: 0.71, harbor: 'right', blurb: 'English Harbour, home of the fleet' },
  nevis:        { style: 'english', quay: 0.71, harbor: 'left',  blurb: 'Charlestown, under the cloud peak' },
  stthomas:     { style: 'english', quay: 0.70, harbor: 'right', blurb: 'Danish free port, no questions asked' },
  puertorico:   { style: 'spanish', quay: 0.69, harbor: 'left',  blurb: 'San Juan, behind the great walls' },
  santodomingo: { style: 'spanish', quay: 0.70, harbor: 'right', blurb: 'The first city of the Indies' },
  portroyal:    { style: 'english', quay: 0.64, harbor: 'left',  blurb: 'The wickedest city on Earth' },
  cayman:       { style: 'english', quay: 0.68, harbor: 'right', blurb: 'Turtlers’ isle, flat as a plate' },
  freeport:     { style: 'english', quay: 0.66, harbor: 'left',  blurb: 'Smugglers’ haven of the Bahamas' },
};

// Width / height of each building cut-out, so wide buildings can be shrunk to fit their spot.
TW.BUILDING_ASPECT = {
  'english-bank': 665 / 640, 'english-harbor': 571 / 640, 'english-lender': 274 / 640, 'english-market': 722 / 640,
  'english-shipyard': 717 / 640, 'english-tavern': 552 / 640, 'spanish-bank': 855 / 640, 'spanish-harbor': 675 / 640,
  'spanish-lender': 341 / 640, 'spanish-market': 978 / 563, 'spanish-shipyard': 823 / 640, 'spanish-tavern': 627 / 640,
};
