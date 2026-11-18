// The full rule book shown in the game, in English and Turkish (HTML).
(function (root) {
"use strict";
const card = (kind, name) => `<span class="rb-card k-${kind}">${name}</span>`;

const TR = `
<h2>Kartlı Satranç — Kural Kitabı</h2>
<h3>Temel oyun</h3>
<p>Tıkladığın taş rastgele bir hareket tipi alır (piyon, kale, at, fil, vezir, şah) ve o tipe göre oynar. Yeşil noktalar gidebileceği kareleri gösterir.</p>
<ul>
  <li><b>Her taşa bir zar:</b> Her taş turda bir kez zar atar. Zar hareket edemiyorsa başka taş seçersin; tekrar zar yoktur. Hareket edebilen zar gelirse o taşı oynamak zorundasın.</li>
  <li><b>Şah çekme:</b> Taşın gerçek türüne göredir (kale kale gibi, at at gibi tehdit eder). Kendi şahını tehdit altında bırakan hamle yapılamaz.</li>
  <li><b>Şah küçülür:</b> Şah her şah çekilişinde rastgele bir hareket tipini kaybeder. "Şah" tipini asla kaybetmez.</li>
  <li><b>Şah yenmez:</b> Hiçbir taş şahı yiyemez.</li>
  <li><b>Şah mat:</b> Şahtasın ve kalan hiçbir zarla kaçamıyorsun, ya da şahtayken attığın bütün zarlar boşa çıkıyor.</li>
  <li><b>Pat:</b> Şahta değilsin ama hiçbir taşın hiçbir zarla oynayamıyor. Berabere.</li>
  <li><b>Piyon son sırada:</b> Rok ve klasik terfi yoktur. Son sıraya ulaşan piyon için bir hareket tipi seçersin; o tip zar listene bir kez daha eklenir (şah hariç bütün taşların için). Her piyon bunu bir kez yapar.</li>
</ul>
<h3>Süreler</h3>
<ul>
  <li><b>Hamle süresi</b> (isteğe bağlı): Süre biterse sıran geçer. Şahtayken süren biterse kaybedersin.</li>
  <li><b>Ani ölüm:</b> Hamle süresi kapalı olsa bile, ayarlanan tur sayısından sonra (varsayılan 40 tam tur) her oyuncunun oyunun geri kalanı için kısa bir saati olur (varsayılan 1 dakika). Süresi biten kaybeder.</li>
</ul>
<h3>Kart kullanmak</h3>
<ul>
  <li>Kart kullanmak hamle sayılmaz. Hamleden önce (zar atmadan) en fazla 1 kart kullanabilirsin. İkinci Şans bu hakkı zar attıktan sonra kullanır.</li>
  <li>O hamlede taş yediysen, hamleden sonra 1 kart daha kullanabilirsin.</li>
  <li>Elinde en fazla 7 kart olabilir. 8. kart gelirse birinden vazgeçmelisin.</li>
  <li>Kart süreleri tam tur olarak sayılır (beyaz ve siyahın birer hamlesi).</li>
</ul>
<h3>Kart kazanmak</h3>
<table>
  <tr><th>Olay</th><th>Kart</th><th>İhtimal</th></tr>
  <tr><td>Taş yemek</td><td>${card("barricade", "Barikat")}</td><td>%20 (Sv1 %60 · Sv2 %30 · Sv3 %10)</td></tr>
  <tr><td>Şah çekmek</td><td>${card("abra", "Abracadabra")}</td><td>%30 (Sv1 %70 · Sv2 %30)</td></tr>
  <tr><td>Piyonun son sıraya ulaşması</td><td>${card("mine", "Bana Bacaklarımı Getirin")}</td><td>%70</td></tr>
  <tr><td>Her hamle</td><td>${card("reborn", "Ölüden Doğan")}</td><td>%4</td></tr>
</table>
<p><b>Gezgin:</b> Takımının taşlarının gittiği kareler bir sayacı doldurur (zarla gelen hareketin kaç kare gittiği sayılır; at hareketi her zaman 5 kare). 32 karede ${card("nomad", "Gezgin I")}, 48 kare daha gidince ${card("nomad", "Gezgin II")}, 64 kare daha ${card("nomad", "Gezgin III")}, 80 kare daha ${card("nomad", "Gezgin IV")}. Her seviye mesafeyle bir kez kazanılır. Destede sadece Gezgin I ve II vardır.</p>
<p><b>Zamanlı çekiliş:</b> Varsayılan olarak her 3 tam turda bir iki oyuncu da desteden 1 kart çeker.</p>
<table>
  <tr><th>Deste</th><th>İhtimal</th><th>Deste</th><th>İhtimal</th></tr>
  <tr><td>İkinci Şans</td><td>%8</td><td>Gezgin I</td><td>%4</td></tr>
  <tr><td>Barikat I</td><td>%8</td><td>Deprem</td><td>%4</td></tr>
  <tr><td>Ölüden Doğan</td><td>%7</td><td>Lanetli Zar</td><td>%4</td></tr>
  <tr><td>Bana Bacaklarımı Getirin</td><td>%7</td><td>Taç Onarımı</td><td>%3</td></tr>
  <tr><td>Abracadabra I</td><td>%7</td><td>Abracadabra II</td><td>%3</td></tr>
  <tr><td>Dürbün</td><td>%6</td><td>Elden Ele</td><td>%3</td></tr>
  <tr><td>Işınlanma</td><td>%6</td><td>Karar Benim!</td><td>%3</td></tr>
  <tr><td>Çifte Zar</td><td>%5</td><td>Kart Hırsızı</td><td>%3</td></tr>
  <tr><td>Kalkan</td><td>%5</td><td>Karşı Büyü</td><td>%3</td></tr>
  <tr><td>Barikat II</td><td>%5</td><td>Barikat III</td><td>%2</td></tr>
  <tr><td></td><td></td><td>Gezgin II</td><td>%2</td></tr>
  <tr><td></td><td></td><td>Zaman Çarkı</td><td>%2</td></tr>
</table>
<h3>Puan dükkânı</h3>
<p>Yenen taşlar puan kazandırır: piyon 1, at ve fil 3, kale 5, vezir 9. Bir oyunda en fazla 39 puan toplanır (ayarlanabilir). Satın alma sıranın başında, zar atmadan önce yapılır ve kart kullanma hakkından düşmez.</p>
<table>
  <tr><th>Kart</th><th>Fiyat</th><th>Kart</th><th>Fiyat</th></tr>
  <tr><td>İkinci Şans</td><td>2</td><td>Abracadabra I</td><td>6</td></tr>
  <tr><td>Ölüden Doğan</td><td>3</td><td>Lanetli Zar</td><td>6</td></tr>
  <tr><td>Dürbün</td><td>3</td><td>Taç Onarımı</td><td>6</td></tr>
  <tr><td>Işınlanma</td><td>3</td><td>Barikat II</td><td>7</td></tr>
  <tr><td>Barikat I</td><td>4</td><td>Kart Hırsızı</td><td>7</td></tr>
  <tr><td>Çifte Zar</td><td>4</td><td>Karşı Büyü</td><td>8</td></tr>
  <tr><td>Bana Bacaklarımı Getirin</td><td>5</td><td>Abracadabra II</td><td>9</td></tr>
  <tr><td>Kalkan</td><td>5</td><td>Barikat III</td><td>10</td></tr>
  <tr><td>Deprem</td><td>5</td><td>Gezgin, Elden Ele, Karar Benim!, Zaman Çarkı</td><td>Satılmaz</td></tr>
</table>
<h3>Kartlar</h3>
<p>${card("barricade", "Barikat")} Tahtada bir kareyi kilitler (Sv1 1 tur, Sv2 2 tur, Sv3 3 tur). Kilitli kareye hiçbir taş giremez; kale, fil ve vezir üzerinden geçemez. Karedeki taş donar: hareket edemez, yiyemez, şah çekemez. Şah dondurulamaz.</p>
<p>${card("abra", "Abracadabra")} Rakip, kendi taşlarının hepsini rastgele seçilen tek bir tür olarak görür (Sv1 2 tur, Sv2 3 tur). Şah her zaman şah görünür; tür "şah" gelirse bütün taşlar şah görünür ve gerçek şah altın renkli olur. Süre boyunca rakibin hamle günlüğü, yenen taşlar paneli ve zar kartı gerçek türleri göstermez. Taşlar yine zara göre oynar; kart sadece görünümü değiştirir.</p>
<p>${card("mine", "Bana Bacaklarımı Getirin")} Boş bir kareye mayın koyarsın. Mayını kendi hamleni yapana kadar görürsün, sonra kimse göremez. O kareye gelen taş ölür, senin taşın da. Kayarak üstünden geçmek patlatmaz. Şah mayını zarar görmeden patlatır.</p>
<p>${card("reborn", "Ölüden Doğan")} Rastgele boş bir kareye gizli bir yeniden doğma alanı ekler; kimse yerini göremez. Oraya ilk taşını getiren oyuncu, o taşın bir kopyasını alanın etrafındaki 3x3 bölgeye koyar (yer yoksa 5x5, orada da yoksa hak kaybolur). Şah kopyalanamaz. Kopya kilitli kareye konamaz; mayınlı kareye konabilir ve mayın patlar.</p>
<p>${card("nomad", "Gezgin")} Kullanınca desteden rastgele kart verir: Gezgin I 2 kart, Gezgin II 3 kart, Gezgin III 4 kart, Gezgin IV 5 kart. Dükkânda satılmaz.</p>
<p>${card("second", "İkinci Şans")} Kendi zarını bir kez yeniden atarsın. Zar atıldıktan sonra, taş oynanmadan önce kullanılır ve hamleden önceki kart hakkını kullanır. İkinci zarın sonucu geçerlidir.</p>
<p>${card("double", "Çifte Zar")} Seçtiğin taş için iki zar atarsın ve hangisiyle oynayacağını seçersin. Zar atılmadan önce kullanılır ve hamleden önceki kart hakkını kullanır.</p>
<p>${card("curse", "Lanetli Zar")} Rakibin zar listesine 2 tur boyunca fazladan bir "şah" eklenir; rakibin taşları daha sık tek kare oynar. Şahın kendi hareket listesi etkilenmez. Süre bitince eklenen "şah" listeden çıkar.</p>
<p>${card("shield", "Kalkan")} Seçtiğin bir taş 2 tur boyunca yenemez hale gelir; taş hareket etmeye devam eder. Şaha kalkan verilemez. Kalkanlı taş mayına basarsa mayın patlar, taş zarar görmez.</p>
<p>${card("crown", "Taç Onarımı")} Şahın şah çekildiğinde kaybettiği hareket tiplerinden birini, oyuncunun seçtiği tipi geri getirir. Şah hiç tip kaybetmediyse kullanılamaz.</p>
<p>${card("scope", "Dürbün")} Seçtiğin 3x3'lük bölgedeki gizli mayınları ve Ölüden Doğan alanlarını sadece sana gösterir. Bulunanlar oyunun geri kalanında sana görünür kalır; bölgeye sonradan konanlar görünmez.</p>
<p>${card("counter", "Karşı Büyü")} Elde tutulan tek reaktif kart. Rakip bir kart kullandığında Karşı Büyü elindeyse otomatik devreye girer ve o kartı iptal eder; iki kart da harcanır. Kart kullanma hakkından düşmez; başka bir Karşı Büyü ile iptal edilemez.</p>
<p>${card("thief", "Kart Hırsızı")} Rakibin elinden rastgele bir kart çalarsın. Rakibin eli boşsa kullanılamaz. Elin doluysa bir kartından vazgeçersin.</p>
<p>${card("quake", "Deprem")} Tahtadaki bütün mayınlar, barikatlar ve Ölüden Doğan alanları temizlenir; donmuş taşlar çözülür.</p>
<p>${card("teleport", "Işınlanma")} Seçtiğin kendi taşın rastgele boş bir kareye gider. Şah ışınlanamaz. Kilitli kareler ve kendi şahını şah altında bırakacak kareler seçilmez. Taş gizli bir mayına denk gelirse ölür. Son sıraya ışınlanan piyon bonusu kazanır.</p>
<p>${card("swap", "Elden Ele")} Kendi iki taşının yerini değiştirirsin. Şah ve Barikat'la donmuş taşlar yer değiştiremez. Yer değiştirmeyle son sıraya giden piyon bonusu kazanır. Sadece desteden, düşük ihtimalle çıkar.</p>
<p>${card("mycall", "Karar Benim!")} Rakibin bir sonraki turundaki ilk zarın sonucunu seçersin. Seçilen tip o taşı hareketsiz bırakırsa rakip başka bir taş seçer ve normal zar atar. İlk zar şah için atılıyorsa ve seçilen tip şahın kaybettiği bir tipse kart şaha uygulanmaz, şah normal zar atar. Sadece desteden çıkar.</p>
<p>${card("rewind", "Zaman Çarkı")} Rakibin son hamlesini geri alırsın: tahta, yenen taşlar, puanlar, Gezgin mesafesi, patlayan mayın ve piyon bonusu o hamleden önceki haline döner; o hamleyle kazanılan kartlar elden çıkar. Rakip o turu kaybeder, sıra sende kalır ve normal hamleni yaparsın. Sadece desteden çıkar.</p>
<h3>Çevrimiçi</h3>
<ul>
  <li>Bir ad seçersin; diğer oyuncular seni lobide görür ve davet edebilir.</li>
  <li>Çevrimiçi oyunlarda galibiyet 3, beraberlik 1 puan verir. Liderlik tablosu puana göre sıralanır.</li>
  <li>Biten her oyunun tekrarı paylaşılabilir bir bağlantıyla izlenebilir.</li>
</ul>`;

const EN = `
<h2>Card Chess — Rule Book</h2>
<h3>The basic game</h3>
<p>The piece you click gets a random move type (pawn, rook, knight, bishop, queen or king) and moves like that type. Green dots show the squares it can reach.</p>
<ul>
  <li><b>One roll per piece:</b> each piece rolls once per turn. If the roll can't move, pick another piece; there are no re-rolls. Once a roll can move, you must move that piece.</li>
  <li><b>Check</b> uses each piece's real type (a rook threatens like a rook, a knight like a knight). You can't make a move that leaves your own king attacked.</li>
  <li><b>The king shrinks:</b> every time a king is checked it loses one move type at random. It never loses "king".</li>
  <li><b>Kings can't be captured</b> by any piece.</li>
  <li><b>Checkmate:</b> you're in check and no roll gets you out, or every piece you roll fails while you're in check.</li>
  <li><b>Stalemate:</b> you're not in check but none of your pieces can move with any roll. It's a draw.</li>
  <li><b>Pawn on the far side:</b> no castling and no normal promotion. When a pawn reaches the last row you pick a move type, and it's added to your roll list again (for all your pieces except the king). Each pawn does this once.</li>
</ul>
<h3>Timers</h3>
<ul>
  <li><b>Turn timer</b> (optional): if it runs out, your turn is skipped. If it runs out while you're in check, you lose.</li>
  <li><b>Sudden death:</b> even with no turn timer, after the set number of full turns (40 by default) each player gets a short clock for the rest of the game (1 minute by default). Whoever runs out of time loses.</li>
</ul>
<h3>Using cards</h3>
<ul>
  <li>Using a card isn't a move. Before your move (before rolling) you may use at most 1 card. Second Chance uses that card after rolling.</li>
  <li>If your move captured a piece, you may use 1 more card after it.</li>
  <li>You can hold at most 7 cards. If you get an 8th, you must throw one away.</li>
  <li>Card durations count full turns (one White move and one Black move).</li>
</ul>
<h3>Getting cards</h3>
<table>
  <tr><th>Event</th><th>Card</th><th>Chance</th></tr>
  <tr><td>Capturing a piece</td><td>${card("barricade", "Barricade")}</td><td>20% (L1 60% · L2 30% · L3 10%)</td></tr>
  <tr><td>Giving check</td><td>${card("abra", "Abracadabra")}</td><td>30% (L1 70% · L2 30%)</td></tr>
  <tr><td>A pawn reaching the end</td><td>${card("mine", "Bring Me My Legs")}</td><td>70%</td></tr>
  <tr><td>Any move</td><td>${card("reborn", "Risen from the Dead")}</td><td>4%</td></tr>
</table>
<p><b>Wanderer:</b> the squares your pieces travel fill a counter (it counts how far the rolled move went; a knight move always counts as 5). At 32 squares you get ${card("nomad", "Wanderer I")}, after 48 more ${card("nomad", "Wanderer II")}, after 64 more ${card("nomad", "Wanderer III")}, and after 80 more ${card("nomad", "Wanderer IV")}. Each level is earned by distance once. Only Wanderer I and II are in the deck.</p>
<p><b>Timed draw:</b> by default, every 3 full turns both players draw 1 card from the deck.</p>
<table>
  <tr><th>Deck</th><th>Chance</th><th>Deck</th><th>Chance</th></tr>
  <tr><td>Second Chance</td><td>8%</td><td>Wanderer I</td><td>4%</td></tr>
  <tr><td>Barricade I</td><td>8%</td><td>Earthquake</td><td>4%</td></tr>
  <tr><td>Risen from the Dead</td><td>7%</td><td>Cursed Dice</td><td>4%</td></tr>
  <tr><td>Bring Me My Legs</td><td>7%</td><td>Crown Repair</td><td>3%</td></tr>
  <tr><td>Abracadabra I</td><td>7%</td><td>Abracadabra II</td><td>3%</td></tr>
  <tr><td>Binoculars</td><td>6%</td><td>Hand to Hand</td><td>3%</td></tr>
  <tr><td>Teleport</td><td>6%</td><td>My Call!</td><td>3%</td></tr>
  <tr><td>Double Dice</td><td>5%</td><td>Card Thief</td><td>3%</td></tr>
  <tr><td>Shield</td><td>5%</td><td>Counterspell</td><td>3%</td></tr>
  <tr><td>Barricade II</td><td>5%</td><td>Barricade III</td><td>2%</td></tr>
  <tr><td></td><td></td><td>Wanderer II</td><td>2%</td></tr>
  <tr><td></td><td></td><td>Wheel of Time</td><td>2%</td></tr>
</table>
<h3>The points shop</h3>
<p>Captures earn points: pawn 1, knight and bishop 3, rook 5, queen 9. You can earn at most 39 points per game (adjustable). You buy at the start of your turn, before rolling, and buying doesn't use up your card for the turn.</p>
<table>
  <tr><th>Card</th><th>Price</th><th>Card</th><th>Price</th></tr>
  <tr><td>Second Chance</td><td>2</td><td>Abracadabra I</td><td>6</td></tr>
  <tr><td>Risen from the Dead</td><td>3</td><td>Cursed Dice</td><td>6</td></tr>
  <tr><td>Binoculars</td><td>3</td><td>Crown Repair</td><td>6</td></tr>
  <tr><td>Teleport</td><td>3</td><td>Barricade II</td><td>7</td></tr>
  <tr><td>Barricade I</td><td>4</td><td>Card Thief</td><td>7</td></tr>
  <tr><td>Double Dice</td><td>4</td><td>Counterspell</td><td>8</td></tr>
  <tr><td>Bring Me My Legs</td><td>5</td><td>Abracadabra II</td><td>9</td></tr>
  <tr><td>Shield</td><td>5</td><td>Barricade III</td><td>10</td></tr>
  <tr><td>Earthquake</td><td>5</td><td>Wanderer, Hand to Hand, My Call!, Wheel of Time</td><td>Not for sale</td></tr>
</table>
<h3>The cards</h3>
<p>${card("barricade", "Barricade")} Locks a square (L1 1 turn, L2 2 turns, L3 3 turns). No piece can enter it, and rooks, bishops and queens can't slide through it. A piece on it is frozen: it can't move, capture or give check. Kings can't be frozen.</p>
<p>${card("abra", "Abracadabra")} Your opponent sees all their own pieces as one random type (L1 2 turns, L2 3 turns). The king always looks like a king; if the type is "king", every piece looks like a king and the real one is gold. Meanwhile their move log, captured pieces and roll panel don't show real types. Pieces still move by their rolls; the card only changes how they look.</p>
<p>${card("mine", "Bring Me My Legs")} Hide a mine on an empty square. You see it until you make your move, then nobody does. Any piece that lands there dies, yours too. Sliding over it is safe. A king sets it off unharmed.</p>
<p>${card("reborn", "Risen from the Dead")} Adds a hidden respawn spot on a random empty square; nobody can see where. The first player to bring a piece there places a copy of it in the 3x3 area around the spot (5x5 if that's full; if that's full too, the chance is lost). Kings can't be copied. A copy can't go on a locked square; it can go on a mine square, and the mine goes off.</p>
<p>${card("nomad", "Wanderer")} Gives you random cards from the deck: Wanderer I 2 cards, Wanderer II 3, Wanderer III 4, Wanderer IV 5. Not sold in the shop.</p>
<p>${card("second", "Second Chance")} Re-roll your own roll once. Use it after rolling, before moving; it uses your before-the-move card. The second roll counts.</p>
<p>${card("double", "Double Dice")} Roll twice for the piece you pick and choose which roll to play. Use it before rolling; it uses your before-the-move card.</p>
<p>${card("curse", "Cursed Dice")} Your opponent's roll list gets an extra "king" for 2 turns, so their pieces move one square more often. The king's own move list isn't affected. When it ends, the extra "king" is removed.</p>
<p>${card("shield", "Shield")} A piece you pick can't be captured for 2 turns; it keeps moving. Kings can't be shielded. If a shielded piece steps on a mine, the mine goes off and the piece is unharmed.</p>
<p>${card("crown", "Crown Repair")} Gives your king back one move type it lost to a check, the one you choose. Can't be used if the king hasn't lost any.</p>
<p>${card("scope", "Binoculars")} Shows you, and only you, the hidden mines and respawn spots in a 3x3 area you pick. What you find stays visible to you for the rest of the game; things placed there later don't show.</p>
<p>${card("counter", "Counterspell")} The only card that works from your hand. When your opponent uses a card while you hold Counterspell, it triggers by itself and cancels that card; both cards are used up. It doesn't use your card for the turn, and another Counterspell can't cancel it.</p>
<p>${card("thief", "Card Thief")} Steal a random card from your opponent's hand. Can't be used if their hand is empty. If your hand is full, you throw one away.</p>
<p>${card("quake", "Earthquake")} Clears every mine, Barricade and respawn spot on the board; frozen pieces thaw.</p>
<p>${card("teleport", "Teleport")} One of your pieces goes to a random empty square. Kings can't teleport. Locked squares and squares that would leave your king in check are never chosen. If it lands on a hidden mine, it dies. A pawn that teleports to the last row gets the bonus.</p>
<p>${card("swap", "Hand to Hand")} Two of your pieces trade places. Kings and pieces frozen by a Barricade can't swap. A pawn that lands on the last row gets the bonus. Only from the deck, rarely.</p>
<p>${card("mycall", "My Call!")} You choose the result of your opponent's first roll next turn. If that type leaves the piece unable to move, they pick another piece and roll normally. If the first roll is for the king and the type is one the king has lost, the card doesn't apply and the king rolls normally. Only from the deck.</p>
<p>${card("rewind", "Wheel of Time")} Undo your opponent's last move: the board, captured pieces, points, Wanderer distance, exploded mines and the pawn bonus go back to how they were; cards won with that move leave their hand. They lose that turn, and it stays your turn to make your normal move. Only from the deck.</p>
<h3>Online</h3>
<ul>
  <li>You choose a name; other players see you in the lobby and can invite you.</li>
  <li>In online games a win is worth 3 points and a draw 1. The leaderboard is sorted by points.</li>
  <li>Every finished game has a replay you can watch through a shareable link.</li>
</ul>`;

root.RULEBOOK = { en: EN, tr: TR };
})(this);
