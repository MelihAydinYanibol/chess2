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
  <li>Kart kullanmak hamle sayılmaz. Hamleden önce (zar atmadan) en fazla 1 kart kullanabilirsin.</li>
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
<p><b>Gezgin:</b> Takımının taşlarının gittiği kareler bir sayacı doldurur (zarla gelen hareketin kaç kare gittiği sayılır; at hareketi her zaman 5 kare). 32 karede ${card("nomad", "Gezgin I")}, 48 kare daha gidince ${card("nomad", "Gezgin II")}.</p>
<p><b>Zamanlı çekiliş:</b> Varsayılan olarak her 3 tam turda bir iki oyuncu da desteden 1 kart çeker.</p>
<table>
  <tr><th>Deste</th><th>İhtimal</th></tr>
  <tr><td>Barikat I</td><td>%18</td></tr><tr><td>Ölüden Doğan</td><td>%16</td></tr><tr><td>Bana Bacaklarımı Getirin</td><td>%15</td></tr>
  <tr><td>Abracadabra I</td><td>%14</td></tr><tr><td>Barikat II</td><td>%10</td></tr><tr><td>Gezgin I</td><td>%8</td></tr>
  <tr><td>Abracadabra II</td><td>%6</td></tr><tr><td>Barikat III</td><td>%5</td></tr><tr><td>Gezgin II</td><td>%4</td></tr>
</table>
<h3>Puan dükkânı</h3>
<p>Yenen taşlar puan kazandırır: piyon 1, at ve fil 3, kale 5, vezir 9. Bir oyunda en fazla 39 puan toplanır (ayarlanabilir). Satın alma sıranın başında, zar atmadan önce yapılır ve kart kullanma hakkından düşmez.</p>
<table>
  <tr><th>Kart</th><th>Fiyat</th></tr>
  <tr><td>Ölüden Doğan</td><td>3</td></tr><tr><td>Barikat I</td><td>4</td></tr><tr><td>Bana Bacaklarımı Getirin</td><td>5</td></tr>
  <tr><td>Abracadabra I</td><td>6</td></tr><tr><td>Barikat II</td><td>7</td></tr><tr><td>Abracadabra II</td><td>9</td></tr>
  <tr><td>Barikat III</td><td>10</td></tr><tr><td>Gezgin I / II</td><td>Satılmaz</td></tr>
</table>
<h3>Kartlar</h3>
<p>${card("barricade", "Barikat")} Tahtada bir kareyi kilitler (Sv1 1 tur, Sv2 2 tur, Sv3 3 tur). Kilitli kareye hiçbir taş giremez; kale, fil ve vezir üzerinden geçemez. Karedeki taş donar: hareket edemez, yiyemez, şah çekemez. Şah dondurulamaz.</p>
<p>${card("abra", "Abracadabra")} Rakip, kendi taşlarının hepsini rastgele seçilen tek bir tür olarak görür (Sv1 2 tur, Sv2 3 tur). Şah her zaman şah görünür; tür "şah" gelirse bütün taşlar şah görünür ve gerçek şah altın renkli olur. Süre boyunca rakibin hamle günlüğü, yenen taşlar paneli ve zar kartı gerçek türleri göstermez. Taşlar yine zara göre oynar; kart sadece görünümü değiştirir.</p>
<p>${card("mine", "Bana Bacaklarımı Getirin")} Boş bir kareye mayın koyarsın. Mayını kendi hamleni yapana kadar görürsün, sonra kimse göremez. O kareye gelen taş ölür, senin taşın da. Kayarak üstünden geçmek patlatmaz. Şah mayını zarar görmeden patlatır.</p>
<p>${card("reborn", "Ölüden Doğan")} Rastgele boş bir kareye gizli bir yeniden doğma alanı ekler; kimse yerini göremez. Oraya ilk taşını getiren oyuncu, o taşın bir kopyasını alanın etrafındaki 3x3 bölgeye koyar (yer yoksa 5x5, orada da yoksa hak kaybolur). Şah kopyalanamaz. Kopya kilitli kareye konamaz; mayınlı kareye konabilir ve mayın patlar.</p>
<p>${card("nomad", "Gezgin")} Kullanınca desteden rastgele kart verir: Gezgin I 2 kart, Gezgin II 3 kart. Dükkânda satılmaz.</p>
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
  <li>Using a card isn't a move. Before your move (before rolling) you may use at most 1 card.</li>
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
<p><b>Wanderer:</b> the squares your pieces travel fill a counter (it counts how far the rolled move went; a knight move always counts as 5). At 32 squares you get ${card("nomad", "Wanderer I")}, and after 48 more ${card("nomad", "Wanderer II")}.</p>
<p><b>Timed draw:</b> by default, every 3 full turns both players draw 1 card from the deck.</p>
<table>
  <tr><th>Deck</th><th>Chance</th></tr>
  <tr><td>Barricade I</td><td>18%</td></tr><tr><td>Risen from the Dead</td><td>16%</td></tr><tr><td>Bring Me My Legs</td><td>15%</td></tr>
  <tr><td>Abracadabra I</td><td>14%</td></tr><tr><td>Barricade II</td><td>10%</td></tr><tr><td>Wanderer I</td><td>8%</td></tr>
  <tr><td>Abracadabra II</td><td>6%</td></tr><tr><td>Barricade III</td><td>5%</td></tr><tr><td>Wanderer II</td><td>4%</td></tr>
</table>
<h3>The points shop</h3>
<p>Captures earn points: pawn 1, knight and bishop 3, rook 5, queen 9. You can earn at most 39 points per game (adjustable). You buy at the start of your turn, before rolling, and buying doesn't use up your card for the turn.</p>
<table>
  <tr><th>Card</th><th>Price</th></tr>
  <tr><td>Risen from the Dead</td><td>3</td></tr><tr><td>Barricade I</td><td>4</td></tr><tr><td>Bring Me My Legs</td><td>5</td></tr>
  <tr><td>Abracadabra I</td><td>6</td></tr><tr><td>Barricade II</td><td>7</td></tr><tr><td>Abracadabra II</td><td>9</td></tr>
  <tr><td>Barricade III</td><td>10</td></tr><tr><td>Wanderer I / II</td><td>Not for sale</td></tr>
</table>
<h3>The cards</h3>
<p>${card("barricade", "Barricade")} Locks a square (L1 1 turn, L2 2 turns, L3 3 turns). No piece can enter it, and rooks, bishops and queens can't slide through it. A piece on it is frozen: it can't move, capture or give check. Kings can't be frozen.</p>
<p>${card("abra", "Abracadabra")} Your opponent sees all their own pieces as one random type (L1 2 turns, L2 3 turns). The king always looks like a king; if the type is "king", every piece looks like a king and the real one is gold. Meanwhile their move log, captured pieces and roll panel don't show real types. Pieces still move by their rolls; the card only changes how they look.</p>
<p>${card("mine", "Bring Me My Legs")} Hide a mine on an empty square. You see it until you make your move, then nobody does. Any piece that lands there dies, yours too. Sliding over it is safe. A king sets it off unharmed.</p>
<p>${card("reborn", "Risen from the Dead")} Adds a hidden respawn spot on a random empty square; nobody can see where. The first player to bring a piece there places a copy of it in the 3x3 area around the spot (5x5 if that's full; if that's full too, the chance is lost). Kings can't be copied. A copy can't go on a locked square; it can go on a mine square, and the mine goes off.</p>
<p>${card("nomad", "Wanderer")} Gives you random cards from the deck: Wanderer I 2 cards, Wanderer II 3 cards. Not sold in the shop.</p>
<h3>Online</h3>
<ul>
  <li>You choose a name; other players see you in the lobby and can invite you.</li>
  <li>In online games a win is worth 3 points and a draw 1. The leaderboard is sorted by points.</li>
  <li>Every finished game has a replay you can watch through a shareable link.</li>
</ul>`;

root.RULEBOOK = { en: EN, tr: TR };
})(this);
